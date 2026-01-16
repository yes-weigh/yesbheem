# Firestore Cleanup Scripts

## cleanup_sessions.js

This script cleans up all session data and activity logs from Firestore to start with a clean slate.

### What it cleans:

1. **Active Sessions** - Removes all `activeSessions.*` entries from user documents
2. **Activity Logs** - Deletes all entries from `user_activity_logs` collection
3. **Security Audit Logs** - Deletes all entries from `security_audit` collection
4. **Temporary OTPs** - Deletes all entries from `temp_otps` collection

### What it preserves:

- User accounts and profiles
- Authorized devices (keeps `authorizedDevices` and `authorizedDevice` fields)
- All other user data

### Prerequisites:

1. Node.js installed
2. Firebase Admin SDK installed: `npm install firebase-admin`
3. Service account key file at `../serviceAccountKey.json`

### How to run:

```bash
# From the kerala directory
node scripts/cleanup_sessions.js
```

### Expected output:

```
🧹 Starting cleanup process...

📋 Step 1: Cleaning up user sessions...
   ✅ Removed 10 active sessions from 3 users

📋 Step 2: Deleting activity logs...
   ✅ Deleted 45 activity log entries

📋 Step 3: Deleting security audit logs...
   ✅ Deleted 2 security audit entries

📋 Step 4: Cleaning up temporary OTPs...
   ✅ Deleted 1 temporary OTP entries

✨ Cleanup completed successfully!

📊 Summary:
   - Active sessions removed: 10
   - Activity logs deleted: 45
   - Security audits deleted: 2
   - Temp OTPs deleted: 1

🎯 Your Firestore is now clean and ready for testing!
```

### After cleanup:

1. All users will need to log in again
2. Security Dashboard will show 0 active users and 0 connected devices
3. Activity Logs will be empty
4. Fresh start for testing multi-session vs single-session behavior

### Optional: Reset device authorization

If you also want to reset device authorization (force users to re-authorize their devices), uncomment these lines in the script:

```javascript
if (data.authorizedDevices) {
    updates['authorizedDevices'] = admin.firestore.FieldValue.delete();
}
if (data.authorizedDevice) {
    updates['authorizedDevice'] = admin.firestore.FieldValue.delete();
}
```
