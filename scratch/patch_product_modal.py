import re
import sys

def patch_file():
    with open('web/src/components/ProductDetailModal.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Remove Desktop Action Buttons
    pattern_desktop_btns = re.compile(r'\{\s*/\*\s*Desktop Checkout \/ Buy Action Buttons\s*\*/\s*\}.*?</div>\s*</div>\s*\{\s*/\*\s*Description Panel', re.DOTALL)
    if pattern_desktop_btns.search(content):
        content = pattern_desktop_btns.sub('</div>\n\n            {/* Description Panel', content)
        print("Removed Desktop Action Buttons")
    else:
        print("Could not find Desktop Checkout / Buy Action Buttons")

    # 2. Extract Bottom Bar for Mobile View
    pattern_bottom_bar = re.compile(r'\{\s*/\*\s*Bottom Bar for Mobile View\s*\*/\s*\}.*?</div>\s*\{\s*/\*\s*Fullscreen Media Preview Modal', re.DOTALL)
    match_bottom_bar = pattern_bottom_bar.search(content)

    if match_bottom_bar:
        bottom_bar_content = match_bottom_bar.group(0)
        # Remove it from its current position
        content = content.replace(bottom_bar_content, '{/* Fullscreen Media Preview Modal')
        
        # Modify the bottom bar classes
        # Remove fixed positioning and lg:hidden
        new_bottom_bar = bottom_bar_content.replace('fixed bottom-0 left-0 right-0 z-40', 'relative z-40 w-full mt-auto')
        new_bottom_bar = new_bottom_bar.replace(' lg:hidden', '')
        new_bottom_bar = new_bottom_bar.replace('{/* Bottom Bar for Mobile View */}', '{/* Bottom Action Bar (All Views) */}')
        
        # We want to insert the new bottom bar right after </main>
        main_end = '</main>'
        content = content.replace(main_end, main_end + '\n\n      ' + new_bottom_bar.replace('\n', '\n      '))
        
        # Wait, the closing </div> of new_bottom_bar includes the one before Fullscreen Media Preview Modal
        # Let's just fix the end
        new_bottom_bar = new_bottom_bar.replace('\n      {/* Fullscreen Media Preview Modal', '')
        
        print("Moved Bottom Bar to be under <main>")
    else:
        print("Could not find Bottom Bar for Mobile View")

    with open('web/src/components/ProductDetailModal.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
        
if __name__ == "__main__":
    patch_file()
