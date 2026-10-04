import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { releaseTicketLimits } from '../services/betService';
import { db, auth } from '../firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, deleteField, getDocs, writeBatch } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { calculateEntryPrize } from '../utils/prizeCalculator';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { generateSellerId, getDrawStatus } from '../utils/helpers';
import type { DrawEntryGroup } from '../utils/ticketUtils';
import { getTicketFlatEntries, normalizeTicketDrawEntries } from '../utils/ticketUtils';
import { hasCompleteDrawResults } from '../utils/drawUtils';

// ... (interfaces remain the same)
export type DrawStatus = 'open' | 'closed' | 'inactive';

export interface Draw {
  id: string;
  drawType?: 'normal' | 'special';
  name: string;
  drawTime: string;
  drawTimeSort?: number;
  closeTime: string;
  closeTimeSort?: number;
  digitsMode: number;
  prizeCount?: number;
  chancePricePerPiece?: number;
  specialChancePayouts?: number[];
  chanceMatchPosition?: 'first' | 'last';
  billeteMatchPosition?: 'first' | 'last';
  specialPrizeRules?: SpecialPrizeRule[];
  specialPalePairs?: SpecialPalePairRule[];
  specialBilleteDigits?: number;
  allowedSpecialBets: {
    chance?: boolean;
    pale: boolean;
    billete: boolean;
    billeteExtra?: boolean;
  };
  isActive: boolean;
  results?: string[];
  resultsEnteredAt?: number;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  updatedBy: string;
}

export interface SpecialPrizeRule {
  resultDigits: number;
  chanceEnabled: boolean;
  chanceSegment: 'first' | 'last';
  chancePayoutPerPiece: number;
  billeteEnabled: boolean;
  billeteSegment: 'first' | 'last';
  billeteExtraEnabled: boolean;
  billeteExtraSegment: 'first' | 'last';
  billeteExtraPayouts: number[];
}

export interface SpecialPalePairRule {
  firstPrizeIndex: number;
  secondPrizeIndex: number;
  enabled: boolean;
  multiplier: number;
}

export type GameType = 'CHANCE' | 'PALÉ' | 'BILLETE' | 'BILLETE_ESPECIAL';
export type WinningPosition = '1er' | '2do' | '3er' | '4to' | '5to' | '6to' | '7mo' | '8vo' | '9no' | '10mo' | '1er + 2do' | '1er + 3er' | '2do + 3er' | `${string} + ${string}`;

export interface Entry {
  id?: string;
  number: string;
  amount: number;
  pieces: number; // Cantidad (tiempos)
  type: GameType;
  prize?: number;
  status?: 'pending' | 'winner' | 'loser';
  winningPosition?: WinningPosition;
  priceId?: string; // ID for the price used, for CHANCE type
}

export interface Ticket {
  id: string;
  userId?: string;
  drawId?: string;
  drawIds: string[];
  drawNames: string[];
  entryTypes?: GameType[];
  hasResults?: boolean;
  isWinner?: boolean;
  drawEntries?: DrawEntryGroup[];
  entries: Entry[];
  total: number;
  timestamp: number;
  isPaid?: boolean;
  totalPrize?: number;
  customerName: string;
  sequenceNumber: number;
  sellerName: string;
  sellerId?: string;
  commission: number;
  commissionRateApplied: number;
}

export interface PaleSettings {
  enabled: boolean;
  minAmount: number;
  maxAmountPerPlay: number;
  globalLimitPerCombination: number;
  payouts: {
    firstSecond: number;
    firstThird: number;
    secondThird: number;
  };
}

export interface BilletePayouts {
  exact4: number;
  exact3PrefixOrSuffix: number;
  exact2PrefixOrSuffix: number;
}

export interface BilleteSettings {
  enabled: boolean;
  unitPrice: number;
  globalLimitPerNumber: number;
  payouts: {
    firstPrize: BilletePayouts;
    secondPrize: BilletePayouts;
    thirdPrize: BilletePayouts;
  };
}

export interface ChancePrice {
  id: string;
  name: string;
  value: number;
  isDefault?: boolean;
  payouts: {
    first: number;
    second: number;
    third: number;
  };
}

export interface AppSettings {
  pricePerTime: number; // Fallback/legacy
  chancePrices: ChancePrice[];
  commissionRate: number; // e.g., 0.2 for 20%
  pale: PaleSettings;
  billete: BilleteSettings;
}

export type UserRole = 'CEO' | 'VENDEDOR' | 'USUARIO';

export interface User {
  id: string;
  name: string;
  username: string;
  email?: string;
  role: UserRole;
  status: 'active' | 'inactive';
  commission: number;
  sellerId?: string;
  pin?: string;
}

export interface SpecialPlay {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  rule: string;
  type: string;
}

export type Page = 'sales' | 'history' | 'stats' | 'settings' | 'results' | 'winners' | 'closures' | 'settlement' | 'archives' | 'userSettings';

interface AppState {
  draws: Draw[];
  tickets: Ticket[];
  isTicketsRefreshing: boolean;
  lastTicketsSyncAt: number | null;
  ticketsOwnerId: string | null;
  lastSelectedDrawId: string | null;
  users: User[];
  currentUser: User | null;
  settings: AppSettings;
  nextTicketSequence: number;
  currentPage: Page;
  
  // Actions
  addDraw: (draw: Draw) => void;
  updateDraw: (id: string, draw: Partial<Draw>) => void;
  deleteDraw: (id: string) => void;
  
  addTicket: (ticket: Ticket) => Promise<Ticket>;
  updateTicket: (id: string, ticket: Partial<Ticket>) => Promise<Ticket>;
  deleteTicket: (id: string, drawIds?: string[]) => Promise<{ deleted: boolean; removedDrawIds: string[]; preservedDrawIds: string[] }>;
  incrementSequence: () => void;
  
  addUser: (user: User) => void;
  updateUser: (id: string, user: Partial<User>) => void;
  deleteUser: (id: string) => void;
  setCurrentUser: (user: User | null) => void;

  updateSettings: (settings: Partial<AppSettings>) => void;
  setCurrentPage: (page: Page) => void;
  setLastSelectedDrawId: (drawId: string | null) => void;
  
  // Reuse & Edit logic
  reusedTicket: Ticket | null;
  setReusedTicket: (ticket: Ticket | null) => void;
  editingTicket: Ticket | null;
  setEditingTicket: (ticket: Ticket | null) => void;
  editingDrawIds: string[] | null;
  setEditingDrawIds: (drawIds: string[] | null) => void;
  
  // Results Actions
  setResults: (drawId: string, results: string[]) => Promise<void>;
  removeResults: (drawId: string) => Promise<void>;
  recalculatePrizes: (ticketIds?: string[]) => void;
  resetSalesData: () => Promise<void>;
  getGlobalStats: () => { totalSales: number; totalCommission: number; totalPrizes: number; utility: number };
}

const defaultPayouts = { first: 60, second: 8, third: 4 };

const defaultDraws: Draw[] = [];

const stripUndefinedFields = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map((item) => item === undefined ? null : stripUndefinedFields(item));
  }
  if (value && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype === Object.prototype || prototype === null) {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, item]) => item !== undefined)
          .map(([key, item]) => [key, stripUndefinedFields(item)])
      );
    }
  }
  return value;
};

if (typeof window !== 'undefined') {
  window.localStorage.removeItem('lottopro-storage');
}

const handleInactiveUser = () => {
  alert('Tu cuenta ha sido desactivada. Contacta al administrador.');
  signOut(auth).catch((error) => {
    console.error('Error during sign out after deactivation:', error);
  });
  // Setting currentUser to null will redirect to login page via AuthGuard
  useStore.getState().setCurrentUser(null);
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      draws: defaultDraws,
      tickets: [],
      isTicketsRefreshing: false,
      lastTicketsSyncAt: null,
      ticketsOwnerId: null,
      lastSelectedDrawId: null,
      users: [],
      currentUser: null,
      settings: {
        pricePerTime: 1,
        chancePrices: [
          { 
            id: 'default', 
            name: 'Normal', 
            value: 1, 
            isDefault: true, 
            payouts: defaultPayouts
          }
        ],
        commissionRate: 0.2,
        pale: {
          enabled: true,
          minAmount: 0.10,
          maxAmountPerPlay: 5.00,
          globalLimitPerCombination: 5.00,
          payouts: {
            firstSecond: 1000,
            firstThird: 1000,
            secondThird: 200
          }
        },
        billete: {
          enabled: true,
          unitPrice: 1.00,
          globalLimitPerNumber: 5,
          payouts: {
            firstPrize: { exact4: 2000, exact3PrefixOrSuffix: 50, exact2PrefixOrSuffix: 3 },
            secondPrize: { exact4: 600, exact3PrefixOrSuffix: 20, exact2PrefixOrSuffix: 2 },
            thirdPrize: { exact4: 300, exact3PrefixOrSuffix: 10, exact2PrefixOrSuffix: 1 }
          }
        }
      },
      // ... other initial state properties
      nextTicketSequence: 1,
      currentPage: 'sales',
      reusedTicket: null,
      editingTicket: null,
      editingDrawIds: null,
      setReusedTicket: (ticket) => set({ reusedTicket: ticket }),
      setEditingTicket: (ticket) => set((state) => ({ editingTicket: ticket, editingDrawIds: ticket ? state.editingDrawIds : null })),
      setEditingDrawIds: (drawIds) => set({ editingDrawIds: drawIds }),
      
      addDraw: (draw) => {
        if (auth.currentUser) {
          setDoc(doc(db, 'draws', draw.id), draw).catch(err => handleFirestoreError(err, OperationType.WRITE, `draws/${draw.id}`));
        }
        set((state) => ({ draws: [...state.draws, draw] }));
      },
      updateDraw: (id, updatedDraw) => {
        if (auth.currentUser) {
          setDoc(doc(db, 'draws', id), updatedDraw as any, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `draws/${id}`));
        }
        set((state) => ({
          draws: state.draws.map((d) => (d.id === id ? { ...d, ...updatedDraw } : d)),
        }));
      },
      deleteDraw: (id) => {
        if (auth.currentUser) {
          deleteDoc(doc(db, 'draws', id)).catch(err => handleFirestoreError(err, OperationType.DELETE, `draws/${id}`));
        }
        set((state) => ({
          draws: state.draws.filter((d) => d.id !== id),
        }));
      },
      
      addTicket: async (ticket) => {
        const { currentUser, settings } = get();
        
        if (!currentUser?.id) {
          throw new Error('Usuario sin ID, no se puede generar ticket');
        }

        const normalizedDrawEntries = normalizeTicketDrawEntries(ticket);
        const sourceEntries = normalizedDrawEntries.length > 0
          ? normalizedDrawEntries.flatMap((group) => group.entries)
          : ticket.entries;

        const accumulatedEntries: Entry[] = [];
        sourceEntries.forEach(entry => {
          const existing = accumulatedEntries.find(e => e.number === entry.number && e.type === entry.type);
          if (existing) {
            existing.amount += entry.amount;
            existing.pieces += entry.pieces;
          } else {
            accumulatedEntries.push({ ...entry });
          }
        });
        
        const rate = typeof ticket.commissionRateApplied === 'number'
          ? ticket.commissionRateApplied
          : (currentUser?.commission ?? settings.commissionRate);
        const total = normalizedDrawEntries.length > 0
          ? Number(normalizedDrawEntries.reduce((sum, group) => sum + group.subtotal, 0).toFixed(2))
          : accumulatedEntries.reduce((sum, e) => sum + e.amount, 0) * (ticket.drawIds?.length || 1);
        const commission = Number((total * rate).toFixed(2));

        const finalTicket: Ticket = {
          ...ticket,
          userId: auth.currentUser?.uid ?? null,
          drawId: ticket.drawIds?.[0] ?? null,
          entryTypes: Array.from(new Set(accumulatedEntries.map((entry) => entry.type))),
          hasResults: false,
          isWinner: false,
          ...(currentUser.sellerId ? { sellerId: currentUser.sellerId } : {}),
          drawEntries: normalizedDrawEntries,
          entries: accumulatedEntries,
          total,
          commission,
          commissionRateApplied: rate
        };
        
        if (auth.currentUser) {
          console.log('saving ticket...', finalTicket.id);
          try {
            await setDoc(doc(db, 'tickets', finalTicket.id), finalTicket);
            console.log('ticket saved', finalTicket.id);
          } catch (err) {
            console.error('ticket save failed', err);
            handleFirestoreError(err, OperationType.WRITE, `tickets/${finalTicket.id}`);
            throw err;
          }
        }

        set((state) => {
          const dedupedTickets = state.tickets.filter((t) => t.id !== finalTicket.id);
          return {
            tickets: [finalTicket, ...dedupedTickets].sort((a, b) => b.timestamp - a.timestamp),
          };
        });
        return finalTicket;
      },
      updateTicket: async (id, updatedTicket) => {
        const existingTicket = get().tickets.find((t) => t.id === id);
        if (!existingTicket) {
          throw new Error(`Ticket no encontrado: ${id}`);
        }

        const mergedTicket = { ...existingTicket, ...updatedTicket };
        const existingGroups = normalizeTicketDrawEntries(existingTicket);
        const incomingGroups = normalizeTicketDrawEntries(mergedTicket);
        const requestedDrawIds = get().editingDrawIds || (updatedTicket.drawIds ?? existingTicket.drawIds);
        const editableDrawIds = new Set(requestedDrawIds.filter((drawId) => {
          const draw = get().draws.find((item) => item.id === drawId);
          return !!draw && getDrawStatus(draw) === 'open';
        }));
        if (editableDrawIds.size === 0) throw new Error('No quedan sorteos abiertos para editar.');

        const incomingById = new Map(incomingGroups.map((group) => [group.drawId, group]));
        const existingIds = new Set(existingGroups.map((group) => group.drawId));
        const normalizedDrawEntries = existingGroups
          .filter((group) => !editableDrawIds.has(group.drawId) || incomingById.has(group.drawId))
          .map((group) => editableDrawIds.has(group.drawId) ? incomingById.get(group.drawId)! : group);
        incomingGroups.forEach((group) => {
          if (editableDrawIds.has(group.drawId) && !existingIds.has(group.drawId)) normalizedDrawEntries.push(group);
        });
        if (normalizedDrawEntries.length === 0) throw new Error('El ticket debe conservar al menos un sorteo.');

        const drawIds = normalizedDrawEntries.map((group) => group.drawId);
        const drawNames = normalizedDrawEntries.map((group) => group.drawName);
        const flatEntries = getTicketFlatEntries({ ...mergedTicket, drawEntries: normalizedDrawEntries });
        const total = Number(normalizedDrawEntries.reduce((sum, group) => sum + group.subtotal, 0).toFixed(2));
        const rate = typeof existingTicket.commissionRateApplied === 'number'
          ? existingTicket.commissionRateApplied
          : (get().currentUser?.commission ?? get().settings.commissionRate);
        const drawMap = new Map<string, Draw>(get().draws.map((draw) => [draw.id, draw] as const));
        const totalPrize = normalizedDrawEntries.reduce((sum, group) => {
          const draw = drawMap.get(group.drawId);
          if (!draw?.results?.length) return sum;
          return sum + group.entries.reduce((entrySum, entry) => entrySum + calculateEntryPrize(entry, draw, get().settings).prize, 0);
        }, 0);
        const finalTicket: Ticket = {
          ...mergedTicket,
          drawId: drawIds[0],
          drawIds,
          drawNames,
          entryTypes: Array.from(new Set(flatEntries.map((entry) => entry.type))),
          drawEntries: normalizedDrawEntries,
          entries: flatEntries,
          total,
          totalPrize,
          hasResults: normalizedDrawEntries.some((group) => {
            const draw = drawMap.get(group.drawId);
            return !!draw && hasCompleteDrawResults(draw);
          }),
          isWinner: totalPrize > 0,
          commissionRateApplied: rate,
          commission: Number((total * rate).toFixed(2)),
        };

        if (auth.currentUser) {
          console.log('updating ticket...', id);
          try {
            await updateDoc(doc(db, 'tickets', id), stripUndefinedFields(finalTicket));
            console.log('ticket updated', id);
          } catch (err) {
            console.error('ticket update failed', err);
            handleFirestoreError(err, OperationType.UPDATE, `tickets/${id}`);
            throw err;
          }
        }
        set((state) => ({
          tickets: state.tickets.map((t) => (t.id === id ? finalTicket : t)),
          editingDrawIds: null,
        }));
        return get().tickets.find((ticket) => ticket.id === id) || finalTicket;
      },
      deleteTicket: async (id, requestedDrawIds) => {
        const ticketToDelete = get().tickets.find(t => t.id === id);
        if (!ticketToDelete) return { deleted: false, removedDrawIds: [], preservedDrawIds: [] };
        try {
          const drawGroups = normalizeTicketDrawEntries(ticketToDelete);
          const removedDrawIds = drawGroups
            .filter((group) => {
              const draw = get().draws.find((item) => item.id === group.drawId);
              return !!draw && getDrawStatus(draw) === 'open' && (!requestedDrawIds || requestedDrawIds.includes(group.drawId));
            })
            .map((group) => group.drawId);
          if (removedDrawIds.length === 0) throw new Error('Solo se pueden borrar las jugadas de sorteos abiertos y sin resultados.');

          const removedDrawSet = new Set(removedDrawIds);
          const removedGroups = drawGroups.filter((group) => removedDrawSet.has(group.drawId));
          const preservedGroups = drawGroups.filter((group) => !removedDrawSet.has(group.drawId));
          const removedTicket = {
            ...ticketToDelete,
            drawIds: removedGroups.map((group) => group.drawId),
            drawNames: removedGroups.map((group) => group.drawName),
            drawEntries: removedGroups,
            entries: getTicketFlatEntries({ ...ticketToDelete, drawEntries: removedGroups }),
            total: Number(removedGroups.reduce((sum, group) => sum + group.subtotal, 0).toFixed(2)),
          };
          await releaseTicketLimits(removedTicket, get().settings);

          const deleted = preservedGroups.length === 0;
          const remainingTotal = Number(preservedGroups.reduce((sum, group) => sum + group.subtotal, 0).toFixed(2));
          const rate = ticketToDelete.commissionRateApplied;
          const preservedEntries = getTicketFlatEntries({ ...ticketToDelete, drawEntries: preservedGroups });
          const drawMap = new Map<string, Draw>(get().draws.map((draw) => [draw.id, draw] as const));
          const totalPrize = preservedGroups.reduce((sum, group) => {
            const draw = drawMap.get(group.drawId);
            if (!draw?.results?.length) return sum;
            return sum + group.entries.reduce((entrySum, entry) => entrySum + calculateEntryPrize(entry, draw, get().settings).prize, 0);
          }, 0);
          const updatedTicket: Ticket = {
            ...ticketToDelete,
            drawId: preservedGroups[0]?.drawId,
            drawIds: preservedGroups.map((group) => group.drawId),
            drawNames: preservedGroups.map((group) => group.drawName),
            drawEntries: preservedGroups,
            entries: preservedEntries,
            entryTypes: Array.from(new Set(preservedEntries.map((entry) => entry.type))),
            total: remainingTotal,
            commission: Number((remainingTotal * rate).toFixed(2)),
            totalPrize,
            isWinner: totalPrize > 0,
            hasResults: preservedGroups.some((group) => {
              const draw = drawMap.get(group.drawId);
              return !!draw && hasCompleteDrawResults(draw);
            }),
          };

          if (auth.currentUser) {
            if (deleted) await deleteDoc(doc(db, 'tickets', id));
            else await updateDoc(doc(db, 'tickets', id), stripUndefinedFields(updatedTicket));
          }

          set((state) => ({
            tickets: deleted
              ? state.tickets.filter((t) => t.id !== id)
              : state.tickets.map((ticket) => ticket.id === id ? updatedTicket : ticket),
          }));
          if (!deleted) get().recalculatePrizes([id]);
          return { deleted, removedDrawIds, preservedDrawIds: preservedGroups.map((group) => group.drawId) };
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `tickets/${id}`);
          throw err;
        }
      },
      incrementSequence: () => set((state) => ({ nextTicketSequence: state.nextTicketSequence + 1 })),
      
      addUser: (user) => {
        const sellerId = user.sellerId || generateSellerId();
        const newUser = { ...user, sellerId };
        if (auth.currentUser) {
          setDoc(doc(db, 'users', newUser.id), newUser).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${newUser.id}`));
        }
        set((state) => ({ users: [...state.users, newUser] }));
      },
      updateUser: (id, updatedUser) => {
        if (auth.currentUser) {
            updateDoc(doc(db, 'users', id), updatedUser as any).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${id}`));
        }
        set((state) => {
            const newUsers = state.users.map((u) => (u.id === id ? { ...u, ...updatedUser } : u));
            const isCurrentUser = state.currentUser?.id === id;

            // Security Check: If the current user is being deactivated, log them out.
            if (isCurrentUser && updatedUser.status === 'inactive' && state.currentUser?.status === 'active') {
                // Schedule the logout to allow the UI to update first, preventing race conditions.
                setTimeout(handleInactiveUser, 0);
            }

            return {
                users: newUsers,
                currentUser: isCurrentUser ? { ...state.currentUser!, ...updatedUser } : state.currentUser
            };
        });
    },
      deleteUser: (id) => {
        if (auth.currentUser) {
          deleteDoc(doc(db, 'users', id)).catch(err => handleFirestoreError(err, OperationType.DELETE, `users/${id}`));
        }
        set((state) => ({
          users: state.users.filter((u) => u.id !== id),
        }));
      },
      setCurrentUser: (user) => {
        // Security Check: If a user is inactive, prevent them from being set as the current user.
        if (user && user.status === 'inactive') {
            alert('Este usuario está inactivo. Contacte al administrador.');
            set({ currentUser: null }); // Ensure no user is logged in.
            return;
        }
        set({ currentUser: user });
    },

      updateSettings: (newSettings) => {
        if (auth.currentUser) {
          // Firestore persistence
          const settingsToSave: { [key: string]: any } = {};
          if (newSettings.pale) {
            setDoc(doc(db, 'gameSettings', 'pale'), newSettings.pale).catch(err => handleFirestoreError(err, OperationType.WRITE, 'gameSettings/pale'));
          }
          if (newSettings.billete) {
            setDoc(doc(db, 'gameSettings', 'billete'), newSettings.billete).catch(err => handleFirestoreError(err, OperationType.WRITE, 'gameSettings/billete'));
          }
          const { pale, billete, ...general } = newSettings;
          if (Object.keys(general).length > 0) {
            setDoc(doc(db, 'gameSettings', 'general'), general, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'gameSettings/general'));
          }
        }
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },
      setCurrentPage: (page) => set({ currentPage: page }),
      setLastSelectedDrawId: (drawId) => set({ lastSelectedDrawId: drawId }),

      setResults: async (drawId, results) => {
        if (!auth.currentUser) {
          throw new Error('No authenticated user');
        }

        const draw = get().draws.find((item) => item.id === drawId);
        if (!draw) {
          throw new Error(`Draw not found: ${drawId}`);
        }

        const resultsEnteredAt = Date.now();
        try {
          await setDoc(doc(db, 'draws', drawId), { ...draw, results, resultsEnteredAt }, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `draws/${drawId}`);
        }

        set((state) => {
          const updatedDraws = state.draws.map((d) => (d.id === drawId ? { ...d, results, resultsEnteredAt } : d));
          return { draws: updatedDraws };
        });
        get().recalculatePrizes();
        const affectedTickets = get().tickets.filter((ticket) => ticket.drawIds?.includes(drawId));
        for (let index = 0; index < affectedTickets.length; index += 450) {
          const batch = writeBatch(db);
          affectedTickets.slice(index, index + 450).forEach((ticket) => {
            batch.update(doc(db, 'tickets', ticket.id), stripUndefinedFields(ticket));
          });
          await batch.commit();
        }
      },

      removeResults: async (drawId) => {
        if (!auth.currentUser) {
          throw new Error('No authenticated user');
        }

        const draw = get().draws.find((item) => item.id === drawId);
        if (!draw) {
          throw new Error(`Draw not found: ${drawId}`);
        }

        try {
          await setDoc(doc(db, 'draws', drawId), { ...draw, results: deleteField(), resultsEnteredAt: deleteField() }, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `draws/${drawId}`);
        }

        set((state) => {
          const updatedDraws = state.draws.map((d) => {
            if (d.id === drawId) {
              const { results, resultsEnteredAt, ...rest } = d;
              return rest;
            }
            return d;
          });
          return { draws: updatedDraws };
        });
        get().recalculatePrizes();
        const affectedTickets = get().tickets.filter((ticket) => ticket.drawIds?.includes(drawId));
        for (let index = 0; index < affectedTickets.length; index += 450) {
          const batch = writeBatch(db);
          affectedTickets.slice(index, index + 450).forEach((ticket) => {
            batch.update(doc(db, 'tickets', ticket.id), stripUndefinedFields(ticket));
          });
          await batch.commit();
        }
      },

      recalculatePrizes: (ticketIds) => {
        set((state) => {
          const shouldRecalculateAll = !ticketIds || ticketIds.length === 0;
          const targetTicketIds = shouldRecalculateAll ? null : new Set(ticketIds);
          const drawMap = new Map<string, Draw>(state.draws.map((draw) => [draw.id, draw] as const));

          const updatedTickets = state.tickets.map(ticket => {
            if (!shouldRecalculateAll && !targetTicketIds?.has(ticket.id)) {
              return ticket;
            }

            let totalPrize = 0;
            const updatedDrawEntries = normalizeTicketDrawEntries(ticket).map(group => {
              const draw = drawMap.get(group.drawId);
              const updatedEntries = group.entries.map(entry => {
                let entryPrize = 0;
                let winningPosition: Entry['winningPosition'];
                let status: 'pending' | 'winner' | 'loser' = 'pending';

                if (draw && hasCompleteDrawResults(draw)) {
                  const { prize: currentDrawPrize, winningPosition: currentWinningPosition } = calculateEntryPrize(entry, draw, state.settings);

                  if (currentDrawPrize > 0) {
                    entryPrize += currentDrawPrize;
                    status = 'winner';
                    if (!winningPosition) winningPosition = currentWinningPosition;
                  } else {
                    status = 'loser';
                  }
                }

                totalPrize += entryPrize;
                return { ...entry, prize: entryPrize, status, winningPosition };
              });
              return {
                ...group,
                entries: updatedEntries,
                subtotal: Number(updatedEntries.reduce((sum, entry) => sum + entry.amount, 0).toFixed(2)),
              };
            });

            return {
              ...ticket,
              drawId: ticket.drawIds?.[0],
              hasResults: updatedDrawEntries.some((group) => {
                const draw = drawMap.get(group.drawId);
                return !!draw && hasCompleteDrawResults(draw);
              }),
              isWinner: totalPrize > 0,
              drawEntries: updatedDrawEntries,
              entries: getTicketFlatEntries({ ...ticket, drawEntries: updatedDrawEntries }),
              totalPrize,
            };
          });

          return { tickets: updatedTickets };
        });
      },

      resetSalesData: async () => {
        if (!auth.currentUser) return;
        
        try {
          const { draws } = get();
          const ticketSnapshot = await getDocs(collection(db, 'tickets'));
          const ticketDocs = ticketSnapshot.docs;
          const batchSize = 450;
          const deleteTicketPromises: Promise<void>[] = [];
          
          // Delete every sale document, including tickets from previous dates.
          for (let i = 0; i < ticketDocs.length; i += batchSize) {
            const chunk = ticketDocs.slice(i, i + batchSize);
            const batch = writeBatch(db);
            chunk.forEach((ticketDoc) => batch.delete(ticketDoc.ref));
            deleteTicketPromises.push(batch.commit());
          }
          
          // 2. Clear results from all draws in Firestore
          const drawPromises = draws.map(d => updateDoc(doc(db, 'draws', d.id), { results: deleteField(), resultsEnteredAt: deleteField() }));

          // 3. Clear any historical control docs (limits removed, but collection may still have legacy entries)
          const betsControlSnapshot = await getDocs(collection(db, 'betsControl'));
          const betControlDocs = betsControlSnapshot.docs;
          const deleteBetControlPromises: Promise<void>[] = [];

          for (let i = 0; i < betControlDocs.length; i += batchSize) {
            const chunk = betControlDocs.slice(i, i + batchSize);
            const batch = writeBatch(db);
            chunk.forEach((docSnap) => batch.delete(docSnap.ref));
            deleteBetControlPromises.push(batch.commit());
          }

          const [dailyArchiveSnapshot, archiveRecordSnapshot, legacyArchiveSnapshot] = await Promise.all([
            getDocs(collection(db, 'archivesDaily')),
            getDocs(collection(db, 'archiveRecords')),
            getDocs(collection(db, 'archives')),
          ]);
          const legacyDrawSnapshots = await Promise.all(
            dailyArchiveSnapshot.docs.map((archiveDoc) => getDocs(collection(db, 'archivesDaily', archiveDoc.id, 'draws')))
          );
          const archiveRefs = [
            ...dailyArchiveSnapshot.docs.map((archiveDoc) => archiveDoc.ref),
            ...archiveRecordSnapshot.docs.map((archiveDoc) => archiveDoc.ref),
            ...legacyArchiveSnapshot.docs.map((archiveDoc) => archiveDoc.ref),
            ...legacyDrawSnapshots.flatMap((snapshot) => snapshot.docs.map((drawDoc) => drawDoc.ref)),
          ];
          const deleteArchivePromises: Promise<void>[] = [];
          for (let i = 0; i < archiveRefs.length; i += batchSize) {
            const batch = writeBatch(db);
            archiveRefs.slice(i, i + batchSize).forEach((archiveRef) => batch.delete(archiveRef));
            deleteArchivePromises.push(batch.commit());
          }
          
          await Promise.all([
            ...deleteTicketPromises,
            ...drawPromises,
            ...deleteBetControlPromises,
            ...deleteArchivePromises,
          ]);
          
          // 4. Update local state
          set({
            tickets: [],
            draws: draws.map(d => {
              const { results, resultsEnteredAt, ...rest } = d;
              return rest;
            }),
          });
        } catch (error) {
          console.error('Error resetting sales data:', error);
          throw error;
        }
      },

      getGlobalStats: () => {
        const { tickets } = get();
        const totalSales = tickets.reduce((sum, t) => sum + t.total, 0);
        
        const totalCommission = Number(tickets.reduce((sum, t) => {
          // Use historical commission stored in ticket
          return sum + (t.commission || 0);
        }, 0).toFixed(2));

        const totalPrizes = tickets.reduce((sum, t) => sum + (t.totalPrize || 0), 0);

        const utility = Number(((totalSales - totalCommission) - totalPrizes).toFixed(2));

        return {
          totalSales,
          totalCommission,
          totalPrizes,
          utility
        };
      },
    }),
    {
      name: 'lottopro-v2-storage',
      partialize: (state) => ({
        draws: state.draws,
        settings: state.settings,
        nextTicketSequence: state.nextTicketSequence,
        lastSelectedDrawId: state.lastSelectedDrawId,
      }),
      merge: (persistedState: any, currentState: AppState) => {
        if (!persistedState) return currentState;

        const { draws, tickets, users: _persistedUsers, currentUser: _persistedCurrentUser, ticketsOwnerId: _persistedTicketsOwnerId, ...rest } = persistedState;

        const legacyDefaultDraws = new Map([
          ['anguila-11am', { name: 'Anguila 11am', drawTime: '11:00' }],
          ['anguila-6pm', { name: 'Anguila 6pm', drawTime: '18:00' }],
        ]);
        const isUntouchedLegacySeed = Array.isArray(draws) && draws.length === legacyDefaultDraws.size && draws.every((draw: Draw) => {
          const legacyDraw = legacyDefaultDraws.get(draw.id);
          return legacyDraw && draw.name === legacyDraw.name && draw.drawTime === legacyDraw.drawTime && draw.createdBy === 'system' && draw.updatedBy === 'system';
        });
        const legacyDrawIds = new Set(legacyDefaultDraws.keys());
        const hasLegacyDrawTickets = (tickets || []).some((ticket: Ticket) =>
          legacyDrawIds.has(ticket.drawId || '') ||
          (ticket.drawIds || []).some((drawId) => legacyDrawIds.has(drawId)) ||
          (ticket.drawEntries || []).some((group) => legacyDrawIds.has(group.drawId))
        );
        const drawsToMigrate = isUntouchedLegacySeed && !hasLegacyDrawTickets
          ? defaultDraws
          : Array.isArray(draws) ? draws : currentState.draws;
        const persistedDraws = drawsToMigrate.map((draw: Draw) => {
          const drawTimeSort = typeof draw.drawTimeSort === 'number'
            ? draw.drawTimeSort
            : draw.drawTime.split(':').map(Number).reduce((hours, value, index) => hours + value * (index === 0 ? 60 : 1), 0);
          // Se conserva la hora de cierre existente; solo se completa si falta.
          if (typeof draw.closeTimeSort === 'number' && draw.closeTime) return draw;
          const closeTimeSort = draw.closeTime
            ? draw.closeTime.split(':').map(Number).reduce((hours, value, index) => hours + value * (index === 0 ? 60 : 1), 0)
            : (drawTimeSort - 3 + 1440) % 1440;
          const closeTime = `${Math.floor(closeTimeSort / 60).toString().padStart(2, '0')}:${(closeTimeSort % 60).toString().padStart(2, '0')}`;
          return { ...draw, closeTime, closeTimeSort };
        });

        // --- Start of migration logic ---
        const migratedChancePrices = (rest.settings?.chancePrices || []).map((price: any) => {
          if (!price.payouts) {
            return { ...price, payouts: defaultPayouts };
          }
          return price;
        });

        return {
          ...currentState,
          draws: persistedDraws,
          tickets: currentState.tickets,
          users: currentState.users,
          ...rest,
          settings: {
            ...currentState.settings,
            ...(rest.settings || {}),
            pale: {
              ...currentState.settings.pale,
              ...(rest.settings?.pale || {})
            },
            billete: {
              ...currentState.settings.billete,
              ...(rest.settings?.billete || {})
            },
            chancePrices: Array.isArray(migratedChancePrices) && migratedChancePrices.length > 0 
              ? migratedChancePrices 
              : currentState.settings.chancePrices,
          }
        };
      }
    }
  )
);
