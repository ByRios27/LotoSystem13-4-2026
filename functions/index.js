const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

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

