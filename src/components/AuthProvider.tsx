import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { useStore, Draw, Ticket, User } from '../store/useStore';
import { Lock, AlertCircle, Ticket as TicketIcon, Eye, EyeOff } from 'lucide-react';
import { generateSellerId, getBusinessDate } from '../utils/helpers';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { setCurrentUser } = useStore();
  const currentStoreUser = useStore((state) => state.currentUser);

  useEffect(() => {
    const savedEmail = localStorage.getItem('lottopro_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthError(null);
      if (firebaseUser) {
        setLoading(true);
        
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          
          let userData: User | null = null;

          if (userSnap.exists()) {
            userData = userSnap.data() as User;
          } else if (firebaseUser.email === 'jrios5061@gmail.com') {
            console.log('CEO user not found in Firestore. Creating profile...');
            const newCEOData: User = {
                id: firebaseUser.uid,
                name: firebaseUser.displayName || 'Administrador Principal',
                username: 'admin',
                email: firebaseUser.email,
                role: 'CEO',
                status: 'active',
                commission: 0.25,
                sellerId: generateSellerId(),
                pin: '1234' 
            };
            await setDoc(userRef, newCEOData);
            userData = newCEOData;
          } else {
            throw new Error('User profile not found in database.');
          }

          if (userData.status === 'inactive') {
            setAuthError('Contacte a su proveedor');
            void signOut(auth).catch((error) => console.error('Error signing out inactive user:', error));
            setCurrentUser(null);
          } else {
            setCurrentUser(userData);
          }

        } catch (error) {
          console.error('Auth state change error:', error);
          setAuthError('No se pudo validar tu cuenta. Comprueba tu conexión o contacta al administrador.');
          if (auth.currentUser) {
            void signOut(auth).catch((signOutError) => console.error('Error clearing stalled session:', signOutError));
          }
          setCurrentUser(null);
        }

        setLoading(false);
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    }, (error) => {
      console.error('Auth state observer error:', error);
      setAuthError('No se pudo conectar con el servicio de acceso. Comprueba tu conexión.');
      setCurrentUser(null);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [setCurrentUser]);


  useEffect(() => {
    if (!currentStoreUser) {
      useStore.setState({ tickets: [], users: [], ticketsOwnerId: null, isTicketsRefreshing: false });
      return;
    }

    useStore.setState((state) => ({
      tickets: state.ticketsOwnerId === currentStoreUser.id
        ? state.tickets.filter((ticket) => typeof ticket.timestamp === 'number' && getBusinessDate(ticket.timestamp) === getBusinessDate())
        : [],
      ticketsOwnerId: currentStoreUser.id,
      isTicketsRefreshing: true,
      users: currentStoreUser.role === 'CEO' ? state.users : [],
    }));

    const drawsSub = onSnapshot(collection(db, 'draws'), (snapshot) => {
      const remoteDraws = snapshot.docs.map((drawDoc) => ({
        ...drawDoc.data(),
        id: drawDoc.id,
      } as Draw));

      useStore.setState((state) => {
        const mergedDraws = new Map<string, Draw>();
        remoteDraws.forEach((draw) => {
          const existingDraw = state.draws.find((d) => d.id === draw.id);
          const mergedDraw = { ...existingDraw, ...draw };
          if (!Object.prototype.hasOwnProperty.call(draw, 'results')) {
            delete mergedDraw.results;
            delete mergedDraw.resultsEnteredAt;
          }
          mergedDraws.set(draw.id, mergedDraw);
        });
        return { draws: Array.from(mergedDraws.values()) };
      });
      useStore.getState().recalculatePrizes();
    }, (err) => console.error('Draws subscription error:', err));

    const ticketsQuery = currentStoreUser.role === 'CEO'
      ? collection(db, 'tickets')
      : query(collection(db, 'tickets'), where('userId', '==', currentStoreUser.id));
    const ticketsSub = onSnapshot(ticketsQuery, (snapshot) => {
      const tickets = snapshot.docs
        .map((ticketDoc) => ({ ...ticketDoc.data(), id: ticketDoc.id } as Ticket))
        .filter((ticket) => typeof ticket.timestamp === 'number' && getBusinessDate(ticket.timestamp) === getBusinessDate())
        .sort((a, b) => b.timestamp - a.timestamp);
      useStore.setState({
        tickets,
        ticketsOwnerId: currentStoreUser.id,
        lastTicketsSyncAt: Date.now(),
        isTicketsRefreshing: false,
      });
      // Los premios no se guardan en Firestore; se recalculan con los resultados vigentes.
      useStore.getState().recalculatePrizes();
    }, (err) => {
      useStore.setState({ isTicketsRefreshing: false });
      console.error('Tickets subscription error:', err);
    });

    const settingsSubscriptions = [
      onSnapshot(doc(db, 'gameSettings', 'general'), (snapshot) => {
        if (!snapshot.exists()) return;
        useStore.setState((state) => ({ settings: { ...state.settings, ...snapshot.data() } }));
      }, (err) => console.error('General settings subscription error:', err)),
      onSnapshot(doc(db, 'gameSettings', 'pale'), (snapshot) => {
        if (!snapshot.exists()) return;
        useStore.setState((state) => ({
          settings: { ...state.settings, pale: { ...state.settings.pale, ...snapshot.data() } },
        }));
      }, (err) => console.error('Pale settings subscription error:', err)),
      onSnapshot(doc(db, 'gameSettings', 'billete'), (snapshot) => {
        if (!snapshot.exists()) return;
        useStore.setState((state) => ({
          settings: { ...state.settings, billete: { ...state.settings.billete, ...snapshot.data() } },
        }));
      }, (err) => console.error('Billete settings subscription error:', err)),
    ];

    let usersSub: (() => void) | undefined;
    if (currentStoreUser.role === 'CEO') {
      usersSub = onSnapshot(collection(db, 'users'), (snapshot) => {
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        useStore.setState({ users });
      }, (err) => console.error('Users subscription error:', err));
    }

    return () => {
      drawsSub();
      ticketsSub();
      settingsSubscriptions.forEach((unsubscribe) => unsubscribe());
      usersSub?.();
    };
  }, [currentStoreUser?.id, currentStoreUser?.role]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!email.trim() || !password.trim()) {
        setAuthError("Email y contraseña son requeridos.");
        return;
    }
    setLoading(true);
    try {
      if (rememberMe) {
        localStorage.setItem('lottopro_remembered_email', email);
      } else {
        localStorage.removeItem('lottopro_remembered_email');
      }
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      const invalidCredentials = ['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password', 'auth/invalid-email']
        .includes(error?.code);
      setAuthError(invalidCredentials
        ? 'Usuario o contraseña incorrecta'
        : error?.code === 'auth/network-request-failed'
          ? 'No se pudo conectar con el servicio de acceso. Comprueba internet e intenta de nuevo.'
          : 'No se pudo conectar con el servicio de acceso. Intenta de nuevo.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0B1220] text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (!currentStoreUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0B1220] text-white p-6">
        <div className="w-full max-w-md bg-[#121A2B] rounded-[2.5rem] border border-white/10 p-8 shadow-2xl">
          <div className="text-center mb-8">
            <TicketIcon className="text-brand-primary mx-auto" size={40} />
            <h1 className="text-2xl font-black uppercase tracking-tight mt-4">LottoPro</h1>
          </div>

          {authError && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500">
              <p className="text-xs font-bold text-center uppercase tracking-tight">{authError}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
             <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Email</label>
              <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Escribe tu email"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-brand-primary/50"
                  required
                />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Contraseña</label>
              <div className="relative">
                <input 
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-brand-primary/50 pr-10"
                    required
                  />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white">
                  {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs mt-2">
                <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className='h-4 w-4 rounded bg-slate-700 border-slate-600 text-brand-primary focus:ring-brand-primary'/>
                    Recordar usuario
                </label>
            </div>

            <button 
              type="submit"
              className="w-full bg-brand-primary text-black h-12 rounded-xl font-bold uppercase text-sm tracking-widest active:scale-95 transition-all mt-4"
            >
              Iniciar Sesión
            </button>
          </form>

        </div>
      </div>
    );
  }

  return <>{children}</>;
};
