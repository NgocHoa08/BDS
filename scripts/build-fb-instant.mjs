import { execSync } from 'node:child_process';
import { existsSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const distDir = resolve(root, 'dist');
const outZip = resolve(root, 'bdsnh-fb-instant.zip');

if (!existsSync(resolve(distDir, 'index.html'))) {
  console.error('❌ Không tìm thấy dist/index.html. Hãy chạy `npm run build` trước.');
  process.exit(1);
}
if (!existsSync(resolve(distDir, 'fbapp-config.json'))) {
  console.error('❌ Thiếu dist/fbapp-config.json (kiểm tra public/fbapp-config.json).');
  process.exit(1);
}

if (existsSync(outZip)) {
  rmSync(outZip, { force: true });
}

if (process.platform === 'win32') {
  // Use POSIX forward slashes inside ZIP so Linux hosts (Facebook Instant Games) unpack assets/ cleanly
  const psScript = [
    'Add-Type -AssemblyName System.IO.Compression',
    'Add-Type -AssemblyName System.IO.Compression.FileSystem',
    `$dist = (Resolve-Path '${distDir}').Path`,
    `$zip = [System.IO.Compression.ZipFile]::Open('${outZip}', [System.IO.Compression.ZipArchiveMode]::Create)`,
    'try {',
    '  Get-ChildItem -Path $dist -Recurse -File | ForEach-Object {',
    '    $rel = $_.FullName.Substring($dist.Length + 1).Replace([char]92, [char]47)',
    '    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null',
    '  }',
    '} finally { $zip.Dispose() }',
  ].join('; ');
  execSync(`powershell -NoProfile -Command "${psScript}"`, { stdio: 'inherit' });
} else {
  execSync(`cd "${distDir}" && zip -r "${outZip}" .`, { stdio: 'inherit' });
}

const sizeKb = (statSync(outZip).size / 1024).toFixed(1);
console.log(`\n✅ Đã đóng gói Facebook Instant Games bundle thành công!`);
console.log(`📦 File: ${outZip} (${sizeKb} KB)`);
console.log(`🚀 Up thẳng file .zip này vào: Meta App Dashboard -> Instant Games -> Web Hosting -> Upload Version.`);
