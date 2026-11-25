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
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${outZip}' -Force"`,
    { stdio: 'inherit' }
  );
} else {
  execSync(`cd "${distDir}" && zip -r "${outZip}" .`, { stdio: 'inherit' });
}

const sizeKb = (statSync(outZip).size / 1024).toFixed(1);
console.log(`\n✅ Đã đóng gói Facebook Instant Games bundle thành công!`);
console.log(`📦 File: ${outZip} (${sizeKb} KB)`);
console.log(`🚀 Up thẳng file .zip này vào: Meta App Dashboard -> Instant Games -> Web Hosting -> Upload Version.`);
