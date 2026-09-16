const USERNAME_KEY = 'wolfchatter.username'

type UsernameStorage = Pick<Storage, 'getItem' | 'setItem'>

/** The user name last typed on this device (FR-5), or '' when there is none or no storage. */
export function loadUsername(storage: Pick<UsernameStorage, 'getItem'> | undefined): string {
  try {
    return storage?.getItem(USERNAME_KEY) ?? ''
  } catch {
    return ''
  }
}

/** Remembers the user name. Storage can be disabled or full, and the chat works without it. */
export function saveUsername(
  storage: Pick<UsernameStorage, 'setItem'> | undefined,
  username: string,
): void {
  try {
    storage?.setItem(USERNAME_KEY, username)
  } catch {
    // The name then lasts only as long as the page.
  }
}

/** The browser's localStorage, which merely reading can throw when the user has disabled it. */
export function deviceStorage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}
