import sys
import re

file_path = 'web/src/app/marketplace/[productId]/page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Render reviews at the bottom
review_ui = """
      {/* Product Reviews */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Star className="text-amber-400 fill-amber-400" size={24} />
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Ulasan Produk</h2>
          <span className="text-slate-400 font-bold ml-auto">{reviews.length} Ulasan</span>
        </div>
        {reviews.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-500">Belum ada ulasan untuk produk ini.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map(review => (
              <div key={review.id} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{review.customerName || 'Pembeli'}</span>
                  <div className="flex text-amber-400">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star key={star} size={12} className={star <= (review.rating || 5) ? 'fill-amber-400' : 'text-slate-300 dark:text-slate-700'} />
                    ))}
                  </div>
                </div>
                {review.comment && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">{review.comment}</p>
                )}
                <p className="text-[10px] text-slate-400 mt-2 font-medium">
                  {review.createdAt?.seconds ? new Date(review.createdAt.seconds * 1000).toLocaleDateString('id-ID') : 'Baru saja'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
"""

# Insert review_ui before "      {/* Other Products */}"
content = content.replace('      {/* Other Products */}', review_ui + '\n      {/* Other Products */}')

# 2. Add padding to cart popup so it doesn't get obscured by bottom nav
content = content.replace(
    'className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300"',
    'className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 mb-16 sm:mb-0"'
)

# 3. Make checkout more minimalist and full-page on mobile
content = content.replace(
    'className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/75 dark:bg-black/85 backdrop-blur-md animate-in fade-in duration-300"',
    'className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-white sm:bg-slate-900/75 dark:bg-slate-950 sm:dark:bg-black/85 backdrop-blur-md animate-in fade-in duration-300"'
)
content = content.replace(
    'className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300"',
    'className="bg-white dark:bg-slate-900 sm:border border-slate-200 dark:border-slate-800 sm:rounded-3xl w-full max-w-2xl h-full sm:h-auto sm:max-h-[90vh] flex flex-col shadow-none sm:shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300"'
)


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated marketplace page!")
