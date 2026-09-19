import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'ir.sepidar.productivity',
  appName: 'سپیدار',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_sepidar',
      iconColor: '#4773FA'
    }
  }
}

export default config
