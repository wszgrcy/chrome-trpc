import { runAll } from './run-all-tests';

document.querySelector('#start')!.addEventListener('click', () => {
  runAll(chrome.runtime.connect()).then((result) => {
    const el = document.querySelector('#result')! as HTMLElement;
    el.textContent = JSON.stringify(result);
    el.style.visibility = 'visible';
  });
});
