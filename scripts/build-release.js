const { execFileSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const PKG = require(path.join(ROOT, 'package.json'))
const VERSION = PKG.version
const isWin = process.platform === 'win32'

async function main() {
  // Clean
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true })
  }

  // Build renderer + main + preload
  console.log('> npm run build')
  execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: isWin })

  const platform = process.argv[2] || process.platform
  const arch = process.argv[3] || 'x64'
  console.log(`\nPackaging for ${platform}-${arch}...\n`)

  // Use packager API directly (avoids shell escaping issues)
  const packager = require('@electron/packager')
  const appPaths = await packager({
    dir: ROOT,
    out: DIST,
    platform,
    arch,
    overwrite: true,
    asar: true,
    icon: path.join(ROOT, 'resources', 'icon'),
    appVersion: VERSION,
    ignore: /^\/(src|cli|scripts|\.git|tsconfig|postcss|electron\.vite|forge\.config|\.gitignore|\.env|README|dist)/
  })

  const outputDir = appPaths[0]
  if (!outputDir || !fs.existsSync(outputDir)) {
    console.error('Packaging failed - output directory not found')
    process.exit(1)
  }

  console.log(`\nPackaged to: ${outputDir}`)

  // Create zip
  const outputName = path.basename(outputDir)
  const zipName = `enhanced-authenticator-v${VERSION}-${platform}-${arch}.zip`
  const zipPath = path.join(DIST, zipName)

  console.log(`Creating ${zipName}...`)

  if (isWin) {
    execFileSync('powershell', [
      '-Command',
      `Compress-Archive -Path '${outputDir}\\*' -DestinationPath '${zipPath}' -Force`
    ], { cwd: ROOT, stdio: 'inherit' })
  } else {
    execFileSync('zip', ['-r', zipName, outputName], { cwd: DIST, stdio: 'inherit' })
  }

  const zipSize = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1)
  console.log(`\nDone! ${zipName} (${zipSize} MB)`)
  console.log(`  ${zipPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
