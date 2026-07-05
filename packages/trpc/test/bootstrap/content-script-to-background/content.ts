import { runAll } from '../run-all-tests';

runAll(chrome.runtime.connect()).then((message) => {
  document.body.textContent = '';
  const el = document.createElement('p');
  el.id = 'result';
  el.textContent = JSON.stringify(message);
  el.style.visibility = 'visible';
  document.body.appendChild(el);
});
