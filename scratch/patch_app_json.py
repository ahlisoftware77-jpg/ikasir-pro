import json
import os

file_path = r'e:\yadiapp-project\KASIR\mobile\app.json'

with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Add permissions
permissions = data.get('expo', {}).get('android', {}).get('permissions', [])
new_perms = [
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_DATA_SYNC"
]
for p in new_perms:
    if p not in permissions:
        permissions.append(p)

data['expo']['android']['permissions'] = permissions

# Add plugins for expo-notifications
plugins = data.get('expo', {}).get('plugins', [])

has_notifications_plugin = False
for p in plugins:
    if isinstance(p, list) and p[0] == 'expo-notifications':
        has_notifications_plugin = True
        break
    elif p == 'expo-notifications':
        has_notifications_plugin = True
        break

if not has_notifications_plugin:
    plugins.append([
        "expo-notifications",
        {
            "icon": "./assets/logo.png",
            "color": "#ffffff"
        }
    ])
    data['expo']['plugins'] = plugins

# Save back
with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print("Updated app.json successfully.")
