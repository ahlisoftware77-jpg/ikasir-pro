import { NextResponse } from 'next/server';
import { adminMessaging, adminDb, FieldValue } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  try {
    if (!adminMessaging || !adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not configured on server' }, { status: 500 });
    }

    const body = await req.json();
    const { storeId, title, message, data } = body;

    if (!storeId || !title || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let tokens: string[] = [];
    const tokenToDocMap: { [token: string]: string } = {};

    if (storeId === 'GLOBAL') {
      const settingsSnap = await adminDb.collection('settings').get();
      settingsSnap.forEach((doc) => {
        const storeData = doc.data();
        const docTokens: string[] = storeData?.fcmTokens || [];
        docTokens.forEach((tok) => {
          if (tok && !tokenToDocMap[tok]) {
            tokenToDocMap[tok] = doc.id;
            tokens.push(tok);
          }
        });
      });
    } else {
      const storeSettingsRef = adminDb.collection('settings').doc(`store_${storeId}`);
      const doc = await storeSettingsRef.get();
      
      if (!doc.exists) {
        return NextResponse.json({ error: 'Store not found' }, { status: 404 });
      }

      const storeData = doc.data();
      const docTokens: string[] = storeData?.fcmTokens || [];
      docTokens.forEach((tok) => {
        if (tok && !tokenToDocMap[tok]) {
          tokenToDocMap[tok] = `store_${storeId}`;
          tokens.push(tok);
        }
      });
    }

    if (tokens.length === 0) {
      return NextResponse.json({ message: 'No devices registered for push notifications' }, { status: 200 });
    }

    let successCount = 0;
    let failureCount = 0;
    const chunkSize = 500;

    for (let i = 0; i < tokens.length; i += chunkSize) {
      const chunk = tokens.slice(i, i + chunkSize);
      const payload = {
        notification: {
          title: title,
          body: message,
        },
        data: data || {},
        tokens: chunk,
      };

      const response = await adminMessaging.sendEachForMulticast(payload);
      successCount += response.successCount;
      failureCount += response.failureCount;
      
      // Clean up invalid tokens
      if (response.failureCount > 0) {
        const failedTokensByDoc: { [docId: string]: string[] } = {};
        response.responses.forEach((resp, idx) => {
          if (!resp.success && 
              (resp.error?.code === 'messaging/invalid-registration-token' || 
               resp.error?.code === 'messaging/registration-token-not-registered')) {
            const badToken = chunk[idx];
            const docId = tokenToDocMap[badToken];
            if (docId) {
              if (!failedTokensByDoc[docId]) {
                failedTokensByDoc[docId] = [];
              }
              failedTokensByDoc[docId].push(badToken);
            }
          }
        });
        
        for (const [docId, badTokens] of Object.entries(failedTokensByDoc)) {
          const docRef = adminDb.collection('settings').doc(docId);
          await docRef.update({
            fcmTokens: FieldValue.arrayRemove(...badTokens)
          }).catch((err) => console.error(`Failed to clean tokens for ${docId}:`, err));
          console.log(`Removed ${badTokens.length} invalid FCM tokens for ${docId}`);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      successCount: successCount,
      failureCount: failureCount 
    });

  } catch (error: any) {
    console.error('Error sending notification:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
