import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { MakerZIP } from '@electron-forge/maker-zip'
import { MakerDeb } from '@electron-forge/maker-deb'
import { MakerRpm } from '@electron-forge/maker-rpm'

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: './resources/icon',
    ignore: [
      /^\/(src|cli|scripts|\.git)/,
      /^\/(tsconfig|postcss|electron\.vite|forge\.config)/,
      /^\/(\.gitignore|\.env|README)/
    ]
  },
  makers: [
    new MakerSquirrel({
      setupIcon: './resources/icon.ico'
    }),
    new MakerZIP({}, ['darwin']),
    new MakerDeb({
      options: {
        icon: './resources/icon.png',
        categories: ['Utility', 'Security']
      }
    }),
    new MakerRpm({
      options: {
        icon: './resources/icon.png',
        categories: ['Utility', 'Security']
      }
    })
  ]
}

export default config
