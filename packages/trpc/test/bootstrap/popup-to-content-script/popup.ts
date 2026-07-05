import { runAll } from '../run-all-tests';

chrome.tabs.query({ active: true, currentWindow: true }).then((list) => {
  const port = chrome.tabs.connect(list[0].id!);
  runAll(port).then((result) => {
    chrome.tabs.sendMessage(list[0].id!, { type: 'result', data: result });
  });
});
