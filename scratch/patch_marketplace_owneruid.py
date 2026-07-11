import sys

file_path = r'e:\yadiapp-project\KASIR\mobile\src\screens\MarketplaceScreen.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = "if (sData.ownerId) storeOwnerMap[doc.id] = sData.ownerId;"
replacement = "if (sData.ownerUid) storeOwnerMap[doc.id] = sData.ownerUid;"

content = content.replace(target, replacement)

with open(file_path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Patch applied for ownerUid")
