const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");

admin.initializeApp();

const BUSINESS_TIME_ZONE = "America/Panama";
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 450;

function getBusinessDate(timestamp = Date.now()) {
  const shifted = new Date(timestamp - TWO_HOURS_MS);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(shifted);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function startOfBusinessDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day, 7, 0, 0, 0);
}

function ticketDrawGroups(ticket) {
  if (Array.isArray(ticket.drawEntries) && ticket.drawEntries.length > 0) {
    return ticket.drawEntries;
  }
  return (ticket.drawIds || []).map((drawId, index) => ({
    drawId,
    drawName: ticket.drawNames?.[index] || "Sorteo",
    entries: ticket.entries || [],
    subtotal: (ticket.entries || []).reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
  }));
}

async function deleteExpiredArchives(db, collectionName, now) {
  const collectionRef = db.collection(collectionName);
  while (true) {
    const expired = await collectionRef.where("expiresAt", "<=", now).limit(BATCH_LIMIT).get();
    if (expired.empty) return;
    const batch = db.batch();
    expired.docs.forEach((archiveDoc) => batch.delete(archiveDoc.ref));
    await batch.commit();
  }
}

exports.archiveDailySales = onSchedule({
  schedule: "0 2 * * *",
  timeZone: BUSINESS_TIME_ZONE,
  timeoutSeconds: 540,
  memory: "1GiB",
}, async () => {
  const db = admin.firestore();
  const now = new Date();
  const today = getBusinessDate(now.getTime());
  const cutoff = startOfBusinessDate(today);
  const drawsSnapshot = await db.collection("draws").get();
  const drawsById = new Map(drawsSnapshot.docs.map((drawDoc) => [drawDoc.id, drawDoc.data()]));
  const ticketsSnapshot = await db.collection("tickets")
    .where("timestamp", "<", cutoff)
    .orderBy("timestamp", "asc")
    .get();

  const dayGroups = new Map();
  const records = [];
  const archivedTicketIds = new Set();

  ticketsSnapshot.docs.forEach((ticketDoc) => {
    const ticket = ticketDoc.data();
    if (typeof ticket.userId !== "string" || !ticket.userId) {
      console.warn("Skipping ticket without userId during archive", ticketDoc.id);
      return;
    }

    const businessDate = getBusinessDate(Number(ticket.timestamp || 0));
    const dayId = `${businessDate}_${ticket.userId}`;
    const dayGroup = dayGroups.get(dayId) || {
      businessDate,
      expiresAt: admin.firestore.Timestamp.fromMillis(startOfBusinessDate(businessDate) + 365 * DAY_MS),
      userId: ticket.userId,
      userName: ticket.sellerName || ticket.customerName || "Usuario",
      sellerId: ticket.sellerId || null,
      ticketIds: new Set(),
      draws: new Map(),
      totalSales: 0,
      totalCommission: 0,
      totalPrizes: 0,
    };
    const rate = typeof ticket.commissionRateApplied === "number"
      ? ticket.commissionRateApplied
      : (Number(ticket.total) > 0 ? Number(ticket.commission || 0) / Number(ticket.total) : 0);

    dayGroup.ticketIds.add(ticketDoc.id);
  const archivedDrawEntries = [];
  const archivedDrawSnapshots = [];
    ticketDrawGroups(ticket).forEach((group) => {
      const drawId = group.drawId;
      if (!drawId) return;
      const entries = Array.isArray(group.entries) ? group.entries : [];
      const totalSales = Number(group.subtotal ?? entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0));
      const totalCommission = Number((totalSales * rate).toFixed(2));
      const totalPrizes = Number(entries.reduce((sum, entry) => sum + Number(entry.prize || 0), 0).toFixed(2));
      const draw = drawsById.get(drawId) || {};
      const drawSnapshot = {
        id: drawId,
        name: group.drawName || draw.name || "Sorteo",
        drawTime: draw.drawTime || "",
        closeTime: draw.closeTime || "",
        drawTimeSort: draw.drawTimeSort || 0,
        closeTimeSort: draw.closeTimeSort || 0,
        digitsMode: draw.digitsMode || 2,
        drawType: draw.drawType || "normal",
        prizeCount: draw.prizeCount || 3,
        specialPrizeRules: draw.specialPrizeRules || [],
        specialPalePairs: draw.specialPalePairs || [],
        allowedSpecialBets: draw.allowedSpecialBets || { pale: false, billete: false },
        isActive: draw.isActive !== false,
        createdAt: draw.createdAt || 0,
        updatedAt: draw.updatedAt || 0,
        createdBy: draw.createdBy || "",
        updatedBy: draw.updatedBy || "",
        results: Array.isArray(draw.results) ? draw.results : [],
      };
      const drawSummary = dayGroup.draws.get(drawId) || {
        drawId,
        drawName: group.drawName || draw.name || "Sorteo",
        totalSales: 0,
        totalCommission: 0,
        totalPrizes: 0,
        totalTickets: 0,
        ticketIds: new Set(),
        results: drawSnapshot.results,
      };

      drawSummary.totalSales += totalSales;
      drawSummary.totalCommission += totalCommission;
      drawSummary.totalPrizes += totalPrizes;
      drawSummary.ticketIds.add(ticketDoc.id);
      dayGroup.draws.set(drawId, drawSummary);
      dayGroup.totalSales += totalSales;
      dayGroup.totalCommission += totalCommission;
      dayGroup.totalPrizes += totalPrizes;
      archivedDrawEntries.push({ drawId, drawName: drawSnapshot.name, entries, subtotal: totalSales });
      archivedDrawSnapshots.push(drawSnapshot);
    });

    if (archivedDrawEntries.length > 0) {
      records.push({
        id: `${businessDate}_${ticketDoc.id}`,
        businessDate,
        year: Number(businessDate.slice(0, 4)),
        month: Number(businessDate.slice(5, 7)),
        timezone: BUSINESS_TIME_ZONE,
        userId: ticket.userId,
        userName: ticket.sellerName || "Usuario",
        sellerId: ticket.sellerId || null,
        ticketId: ticketDoc.id,
        timestamp: Number(ticket.timestamp || 0),
        ticketSnapshot: { ...ticket, id: ticketDoc.id },
        drawEntries: archivedDrawEntries,
        drawSnapshots: archivedDrawSnapshots,
        expiresAt: dayGroup.expiresAt,
      });
      archivedTicketIds.add(ticketDoc.id);
    }

    dayGroups.set(dayId, dayGroup);
  });

  const writer = db.bulkWriter();
  dayGroups.forEach((dayGroup, dayId) => {
    const draws = Array.from(dayGroup.draws.values()).map((draw) => {
      const { ticketIds, ...summary } = draw;
      return {
        ...summary,
        totalTickets: ticketIds.size,
        totalSales: Number(draw.totalSales.toFixed(2)),
        totalCommission: Number(draw.totalCommission.toFixed(2)),
        totalPrizes: Number(draw.totalPrizes.toFixed(2)),
      };
    });
    writer.set(db.collection("archivesDaily").doc(dayId), {
      businessDate: dayGroup.businessDate,
      year: Number(dayGroup.businessDate.slice(0, 4)),
      month: Number(dayGroup.businessDate.slice(5, 7)),
      timezone: BUSINESS_TIME_ZONE,
      sourceVersion: "scheduled-v1",
      userId: dayGroup.userId,
      userName: dayGroup.userName,
      sellerId: dayGroup.sellerId,
      draws,
      totals: {
        totalSales: Number(dayGroup.totalSales.toFixed(2)),
        totalCommission: Number(dayGroup.totalCommission.toFixed(2)),
        totalPrizes: Number(dayGroup.totalPrizes.toFixed(2)),
        totalUtility: Number((dayGroup.totalSales - dayGroup.totalCommission - dayGroup.totalPrizes).toFixed(2)),
        totalTickets: dayGroup.ticketIds.size,
      },
      archivedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: dayGroup.expiresAt,
    }, { merge: true });
  });
  records.forEach((record) => {
    const { id, ...data } = record;
    writer.set(db.collection("archiveRecords").doc(id), data, { merge: true });
  });
  await writer.close();

  const archivedTickets = ticketsSnapshot.docs.filter((ticketDoc) => archivedTicketIds.has(ticketDoc.id));
  for (let index = 0; index < archivedTickets.length; index += BATCH_LIMIT) {
    const batch = db.batch();
    archivedTickets.slice(index, index + BATCH_LIMIT).forEach((ticketDoc) => batch.delete(ticketDoc.ref));
    await batch.commit();
  }

  for (let index = 0; index < drawsSnapshot.docs.length; index += BATCH_LIMIT) {
    const batch = db.batch();
    drawsSnapshot.docs.slice(index, index + BATCH_LIMIT).forEach((drawDoc) => {
      batch.update(drawDoc.ref, {
        results: admin.firestore.FieldValue.delete(),
        resultsEnteredAt: admin.firestore.FieldValue.delete(),
      });
    });
    await batch.commit();
  }

  const controls = await db.collection("betsControl").get();
  for (let index = 0; index < controls.docs.length; index += BATCH_LIMIT) {
    const batch = db.batch();
    controls.docs.slice(index, index + BATCH_LIMIT).forEach((controlDoc) => batch.delete(controlDoc.ref));
    await batch.commit();
  }

  await Promise.all([
    deleteExpiredArchives(db, "archivesDaily", now),
    deleteExpiredArchives(db, "archiveRecords", now),
  ]);

  console.log("Daily sales archive completed", {
    businessDate: today,
    ticketCount: archivedTickets.length,
    skippedTicketCount: ticketsSnapshot.size - archivedTickets.length,
    archivedRecordCount: records.length,
    userDayCount: dayGroups.size,
  });
});

exports.createNewUser = functions.https.onCall(async (data, context) => {
  // Ensure the caller is an authenticated user (ideally, check for admin/CEO role)
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const { email, password, displayName, role, commission, pin, sellerId, username } = data;

  if (!email || !password || !displayName) {
      throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required user data: email, password, or displayName."
    );
  }

  try {
    // Create user in Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: displayName,
    });

    // Create user profile in Firestore
    const userRef = admin.firestore().collection("users").doc(userRecord.uid);
    await userRef.set({
      id: userRecord.uid,
      name: displayName,
      username: username,
      email: email,
      role: role || "seller",
      status: "active",
      commission: commission || 0.15,
      sellerId: sellerId || "N/A",
      pin: pin || "1234",
    });

    return { result: `Successfully created user ${displayName} (${email}) with UID ${userRecord.uid}` };
  } catch (error) {
    console.error("Error creating new user:", error);
    throw new functions.https.HttpsError("internal", "Error creating new user.", error.message);
  }
});

exports.resetUserPassword = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const { userId, newPassword } = data;

  if (!userId || !newPassword) {
      throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required data: userId and newPassword."
    );
  }

  try {
    await admin.auth().updateUser(userId, { password: newPassword });
    return { result: `Successfully updated password for user ${userId}.` };
  } catch (error) {
    console.error("Error resetting password:", error);
    throw new functions.https.HttpsError("internal", "Error resetting password.", error.message);
  }
});

