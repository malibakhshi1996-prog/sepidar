import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'ir.zitar.planner',
  appName: 'زیتر',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_zitar',
      iconColor: '#4773FA'
    }
  }
}

export default config
