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

    const storeSettingsRef = adminDb.collection('settings').doc(`store_${storeId}`);
    const doc = await storeSettingsRef.get();
    
    if (!doc.exists) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const storeData = doc.data();
    const tokens: string[] = storeData?.fcmTokens || [];

    if (tokens.length === 0) {
      return NextResponse.json({ message: 'No devices registered for push notifications' }, { status: 200 });
    }

    const payload = {
      notification: {
        title: title,
        body: message,
      },
      data: data || {},
      tokens: tokens,
    };

    const response = await adminMessaging.sendEachForMulticast(payload);
    
    // Clean up invalid tokens
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && 
            (resp.error?.code === 'messaging/invalid-registration-token' || 
             resp.error?.code === 'messaging/registration-token-not-registered')) {
          failedTokens.push(tokens[idx]);
        }
      });
      
      if (failedTokens.length > 0) {
        await storeSettingsRef.update({
          fcmTokens: FieldValue.arrayRemove(...failedTokens)
        });
        console.log(`Removed ${failedTokens.length} invalid FCM tokens for store_${storeId}`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      successCount: response.successCount,
      failureCount: response.failureCount 
    });

  } catch (error: any) {
    console.error('Error sending notification:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
