import sys
import re

file_path = 'mobile/src/screens/FeatureScreen.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix Scan import
if "Scan" not in content.split("from 'lucide-react-native'")[0]:
    content = content.replace("} from 'lucide-react-native';", ", Scan } from 'lucide-react-native';")

# Remove lucide-react import if I accidentally added it
if ", Scan } from 'lucide-react'" in content:
    content = content.replace(", Scan } from 'lucide-react'", "from 'lucide-react'")

# Fix styles for the scanner button
content = content.replace("style={{ backgroundColor: colors.primary + '20' }}", "className='bg-emerald-500/10'")
content = content.replace("<Scan size={16} color={colors.primary} />", "<Scan size={18} className='text-emerald-500' color='#10b981' />")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed scanner button styles and imports')
