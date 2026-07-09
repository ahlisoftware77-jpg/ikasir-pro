import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  try {
    if (!adminAuth) {
      return NextResponse.json({ error: 'Firebase Admin Auth not configured on server' }, { status: 500 });
    }

    const body = await req.json();
    const { uid } = body;

    if (!uid) {
      return NextResponse.json({ error: 'Missing required field: uid' }, { status: 400 });
    }

    await adminAuth.deleteUser(uid);
    console.log(`Successfully deleted user ${uid} from Firebase Auth.`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting user from Auth:', error);
    
    // If user is already deleted or not found, we can still return success for idempotency
    if (error.code === 'auth/user-not-found') {
      return NextResponse.json({ success: true, message: 'User already not found in Auth' });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
