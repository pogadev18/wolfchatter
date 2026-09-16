/** The chat panel from the mockup: top-right on wide screens, a bottom sheet below 640 px. */
export function ChatPanel() {
  return (
    <aside
      aria-label="Chat"
      className="flex max-h-[50dvh] flex-col border-stone-300 border-t bg-white p-4 shadow-lg sm:absolute sm:top-4 sm:right-4 sm:max-h-[calc(100dvh-5rem)] sm:w-96 sm:rounded-lg sm:border"
    >
      <p className="text-center text-stone-700">Click on the map to start a chat</p>
    </aside>
  )
}
