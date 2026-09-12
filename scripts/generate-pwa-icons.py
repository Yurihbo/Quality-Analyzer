from pathlib import Path
from PIL import Image

source = Path('/home/ubuntu/upload/QualityAnalyzer.png')
out = Path('/home/ubuntu/Quality-Analyzer/client/public')
out.mkdir(parents=True, exist_ok=True)

image = Image.open(source).convert('RGB')
# Preserve the supplied square composition and use high-quality downsampling.
for size, name in [(32, 'favicon-32.png'), (180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png')]:
    image.resize((size, size), Image.Resampling.LANCZOS).save(out / name, format='PNG', optimize=True)

# A maskable icon benefits from a full-bleed dark background; the supplied image already has one.
image.resize((512, 512), Image.Resampling.LANCZOS).save(out / 'icon-maskable-512.png', format='PNG', optimize=True)
print('Generated:', ', '.join(p.name for p in out.glob('*.png')))
                
                
