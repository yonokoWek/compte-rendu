# Generator script
import pathlib

def w(path, content):
    pathlib.Path(path).parent.mkdir(parents=True, exist_ok=True)
    pathlib.Path(path).write_text(content)
    print(f'  wrote {path}')

print('Generating files...')
