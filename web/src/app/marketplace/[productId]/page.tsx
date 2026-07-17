import { Metadata } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';
import MarketplacePage from '../page';

type Props = {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ s?: string; storeId?: string }>;
};

// Helper function to fetch product from Firestore REST API
async function fetchProductRest(projectId: string, productId: string) {
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products/${productId}`,
      { next: { revalidate: 60 } } // Cache for 60 seconds
    );
    if (!res.ok) return null;
    const data = await res.json();
    
    // Parse Firestore REST fields structure
    const fields = data.fields || {};
    const name = fields.name?.stringValue || '';
    const description = fields.description?.stringValue || '';
    
    // Price parsing from integerValue or doubleValue
    let price = 0;
    if (fields.price) {
      price = Number(fields.price.integerValue || fields.price.doubleValue || 0);
    }
    
    let imageUrl = '';
    if (fields.imageUrl?.stringValue) {
      imageUrl = fields.imageUrl.stringValue;
    } else if (fields.imageUrls?.arrayValue?.values?.[0]?.stringValue) {
      imageUrl = fields.imageUrls.arrayValue.values[0].stringValue;
    }
    
    return { name, description, price, imageUrl };
  } catch (error) {
    console.error("Error fetching product via REST API:", error);
    return null;
  }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const productId = resolvedParams.productId;
  const storeId = resolvedSearchParams.s || resolvedSearchParams.storeId;

  const defaultTitle = 'Marketplace iKasir Pro';
  const defaultDesc = 'Temukan berbagai produk unggulan langsung dari merchant iKasir yang terpercaya.';
  
  if (!productId) {
    return { title: defaultTitle, description: defaultDesc };
  }

  try {
    let tenantProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'kasir-3d12b';
    let storeName = 'Toko Mitra';

    // 1. Fetch store info from Primary DB if adminDb is available
    if (adminDb && storeId) {
      const storeSnap = await adminDb.collection('stores').doc(storeId).get();
      if (storeSnap.exists) {
        const storeData = storeSnap.data();
        storeName = storeData?.storeName || 'Toko Mitra';
        const cfg = storeData?.infraConfig;
        if (cfg && (cfg.projectId || cfg.fb_project_id)) {
          tenantProjectId = cfg.projectId || cfg.fb_project_id;
        }
      }
    }

    // 2. Fetch product via REST API
    const product = await fetchProductRest(tenantProjectId, productId);
    
    if (product) {
      const title = `${product.name} - ${storeName}`;
      const description = product.price > 0 
        ? `Rp ${product.price.toLocaleString('id-ID')} | ${product.description || 'Beli sekarang di iKasir Pro!'}`
        : product.description || 'Beli sekarang di iKasir Pro!';
      
      const images = product.imageUrl ? [product.imageUrl] : [];

      return {
        title,
        description,
        openGraph: {
          title: product.name,
          description,
          images,
          type: 'website',
        },
        twitter: {
          card: 'summary_large_image',
          title: product.name,
          description,
          images,
        }
      };
    }
  } catch (error) {
    console.error("Failed to generate metadata for product page:", error);
  }

  return { title: defaultTitle, description: defaultDesc };
}

export default function ProductIdPage() {
  return <MarketplacePage />;
}
