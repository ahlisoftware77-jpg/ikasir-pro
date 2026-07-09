import sys
import re

file_path = 'mobile/src/screens/FeatureScreen.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace any occurrence of both className="ml-2..." and className='bg-emerald...'
pattern = re.compile(r'className="ml-2 w-8 h-8 rounded-lg items-center justify-center"\s+className=\'bg-emerald-500/10\'', re.MULTILINE)
content = re.sub(pattern, 'className="ml-2 w-8 h-8 rounded-lg items-center justify-center bg-emerald-500/10"', content)

pattern2 = re.compile(r'className=\'bg-emerald-500/10\'\s+className="ml-2 w-8 h-8 rounded-lg items-center justify-center"', re.MULTILINE)
content = re.sub(pattern2, 'className="ml-2 w-8 h-8 rounded-lg items-center justify-center bg-emerald-500/10"', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed duplicate attributes')
