import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

let failures = 0
const check = (ok, message) => { console.log(`${ok ? 'OK' : 'MISSING'}: ${message}`); if (!ok) failures++ }
let compiler = ''
try { compiler = execFileSync(process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac') : 'javac', ['-version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } catch {}
check(Number(compiler.match(/javac (\d+)/)?.[1]) >= 21, 'JDK 21+ including javac (installed Capacitor Android uses JavaVersion.VERSION_21)')
let sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
if (!sdk && existsSync('android/local.properties')) sdk = readFileSync('android/local.properties', 'utf8').match(/^sdk\.dir=(.+)$/m)?.[1].replace(/\\:/g, ':').replace(/\\\\/g, '\\').trim()
check(!!sdk && existsSync(sdk), 'Android SDK path via ANDROID_HOME or android/local.properties')
check(!!sdk && existsSync(join(sdk, 'platforms', 'android-36', 'android.jar')), 'Android SDK platform 36')
const builds = sdk && existsSync(join(sdk, 'build-tools')) ? readdirSync(join(sdk, 'build-tools')) : []
check(builds.some(version => existsSync(join(sdk, 'build-tools', version, process.platform === 'win32' ? 'aapt2.exe' : 'aapt2'))), 'Android Build Tools')
check(existsSync('android/gradle/wrapper/gradle-wrapper.jar'), 'Gradle wrapper')
check(existsSync('node_modules/@capacitor/android'), 'Locked npm dependencies (npm ci)')
console.log('Gradle/Maven network access or a pre-populated cache is also required. No credentials or SDK licenses are configured by this script.')
if (failures) console.error(`Android build is blocked by ${failures} missing prerequisites; no APK has been produced.`)
process.exitCode = failures ? 1 : 0
