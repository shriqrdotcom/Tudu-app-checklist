import { supabase, isSupabaseConfigured } from './supabase';

// High quality curated presets for projects & tasks
export const PRESET_PROJECT_IMAGES = [
  'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80', // Web Dev
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80', // Restaurant
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80', // Marketing
  'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80', // Design
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80', // Product Launch
  'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80', // Fitness & Health
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80', // Education
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80', // Home & Life
];

export async function compressAndUploadImage(
  file: File,
  bucket: 'project-images' | 'task-images',
  userId: string
): Promise<string> {
  // Compress client side image to max 1024px width Base64 / Storage object
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const scaleSize = MAX_WIDTH / img.width;
        
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          width = MAX_WIDTH;
          height = img.height * scaleSize;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(event.target?.result as string);
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

        // If real Supabase is configured, upload to bucket
        if (isSupabaseConfigured() && supabase) {
          try {
            const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;
            
            // Convert dataURL to Blob for upload
            const response = await fetch(dataUrl);
            const blob = await response.blob();

            const { data, error } = await supabase.storage
              .from(bucket)
              .upload(fileName, blob, {
                contentType: 'image/jpeg',
                upsert: true,
              });

            if (!error && data) {
              const { data: publicUrlData } = supabase.storage
                .from(bucket)
                .getPublicUrl(data.path);
              return resolve(publicUrlData.publicUrl);
            }
          } catch (err) {
            console.warn('Storage upload error, falling back to data URL', err);
          }
        }

        // Return compressed Data URL fallback
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}
