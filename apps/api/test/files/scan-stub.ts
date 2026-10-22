import type { MalwareScanner, ScanResult } from '../../src/modules/files/malware-scanner'
import { ScannerUnavailableError } from '../../src/modules/files/malware-scanner'

/** The EICAR anti-virus test string, built from parts so this repo file is not itself a test virus. */
export const EICAR = ['X5O!P%@AP[4\\PZX54(P^)7CC)7}$', 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE!', '$H+H*'].join('')

/** Flags any buffer holding EICAR; `down` makes every scan fail as an unreachable scanner would. */
export class StubScanner implements MalwareScanner {
  down = false
  calls = 0
  scan(bytes: Buffer): Promise<ScanResult> {
    this.calls++
    if (this.down) return Promise.reject(new ScannerUnavailableError('ECONNREFUSED'))
    return Promise.resolve(bytes.includes(EICAR) ? { verdict: 'infected', signature: 'Eicar-Test-Signature' } : { verdict: 'clean' })
  }
}
