import sys

file_path = r'e:\yadiapp-project\KASIR\mobile\src\components\OrderNotificationListener.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = """      const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'kasir-3d12b';
      const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAzmifpFOz0asKVDjLJDXVAvfTPNmOEiUw';"""

replacement = """      let projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'kasir-3d12b';
      let apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAzmifpFOz0asKVDjLJDXVAvfTPNmOEiUw';
      
      try {
        const rawInfra = await AsyncStorage.getItem('infra_config_fb');
        if (rawInfra) {
          const parsedInfra = JSON.parse(rawInfra);
          if (parsedInfra.projectId && parsedInfra.apiKey) {
            projectId = parsedInfra.projectId;
            apiKey = parsedInfra.apiKey;
          } else if (parsedInfra.fb_project_id && parsedInfra.fb_api_key) {
            projectId = parsedInfra.fb_project_id;
            apiKey = parsedInfra.fb_api_key;
          }
        }
      } catch (e) {
        console.error('[BG-SERVICE] Error reading infra_config_fb:', e);
      }"""

content = content.replace(target, replacement)

with open(file_path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Patch applied to OrderNotificationListener.tsx")
