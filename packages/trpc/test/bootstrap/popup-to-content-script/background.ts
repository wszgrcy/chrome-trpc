chrome.runtime.onMessage.addListener((data) => {
  if (data.type !== 'start') {
    return;
  }
  chrome.tabs.query({}).then((list) => {
    setTimeout(async () => {
      await chrome.tabs.update(list[1].id!, {
        active: true,
      });
      chrome.action.openPopup({ windowId: list[1].windowId });
    }, 2000);
  });
});
