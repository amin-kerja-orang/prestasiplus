import { bootstrap } from './app/bootstrap'
import { showBootError, watchSlowBoot } from './app/boot-error'
import { disableIconifyNetwork } from './theme/icon-offline'
import './styles/main.css'

// Transport (mock | http), Pinia, router and mount: `src/app/bootstrap.ts` (F-13, overview §4).
// A failed boot shows a visible error with a reload button; a slow one changes the splash text.
// D-09: icons come from the local bundle only; never fetch them from the Iconify API.
disableIconifyNetwork()
watchSlowBoot()
bootstrap().catch(showBootError)
