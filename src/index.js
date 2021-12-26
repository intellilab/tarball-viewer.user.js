import style from './style.css';

async function request(url, options) {
  const res = await new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      url,
      ...options,
      onload: resolve,
      onerror: reject,
    });
  });
  return res.response;
}

async function loadTarball(buffer) {
  const arr = new Uint8Array(buffer);
  const tar = pako.inflate(arr);
  const reader = new tarball.TarReader();
  const items = await reader.readFile(new Blob([tar]));
  items.sort((a, b) => {
    if (a.name > b.name) return 1;
    if (a.name < b.name) return -1;
    return 0;
  });
  return items.map(item => ({
    name: item.name,
    content: reader.getTextFile(item.name),
  }));
}

async function loadTarballByUrl(url) {
  const buffer = await request(url, { responseType: 'arraybuffer' });
  const items = await loadTarball(buffer);
  return items;
}

class NpmUrlProvider {
  baseUrl = 'https://registry.npmjs.org';

  metaUrl(fullname) {
    return `${this.baseUrl}/${fullname}`;
  }

  tarballUrl(fullname, version) {
    const basename = fullname.split('/').pop();
    return `${this.baseUrl}/${fullname}/-/${basename}-${version}.tgz`;
  }
}

class TaobaoUrlProvider extends NpmUrlProvider {
  baseUrl = 'https://registry.npm.taobao.org';

  tarballUrl(fullname, version) {
    return `${this.baseUrl}/${fullname}/download/${fullname}-${version}.tgz`;
  }
}

class TencentUrlProvider extends NpmUrlProvider {
  baseUrl = 'https://mirrors.cloud.tencent.com/npm';
}

const providers = {
  npm: NpmUrlProvider,
  taobao: TaobaoUrlProvider,
  tencent: TencentUrlProvider,
};

async function getLatestVersion(urlProvider, fullname) {
  const meta = await request(urlProvider.metaUrl(fullname), { responseType: 'json' });
  const version = meta['dist-tags'].latest;
  return version;
}

async function loadData(matches) {
  const toast = VM.showToast('Loading...', {
    duration: 0,
  });
  const Provider = providers[GM_getValue('provider')] || providers.npm;
  const urlProvider = new Provider();
  const fullname = matches[1];
  const version = matches[2] || await getLatestVersion(urlProvider, fullname);
  const url = urlProvider.tarballUrl(fullname, version);
  items = await loadTarballByUrl(url);
  toast.close();
  panel.setContent((
    <>
      <header>
        <a onClick={handleClose} innerHTML="&cross;" />
      </header>
      <div className="body">
        <div className="left">
          <ul ref={list => { panel.list = list; }}>
            {items.map((item, i) => (
              <li><a data-index={i} onClick={handleSelect}>{item.name}</a></li>
            ))}
          </ul>
        </div>
        <div className="right">
          <pre ref={pre => { panel.pre = pre; }} />
        </div>
      </div>
    </>
  ));
}

async function main() {
  const matches = window.location.pathname.match(/^\/package\/(.*?)(?:\/v\/([a-z0-9.-]+))?$/);
  if (!matches) {
    VM.showToast('Package not found');
    return;
  }
  if (!panel) {
    panel = VM.getPanel({ style, shadow: true });
    panel.wrapper.classList.add('wrapper');
  }
  await loadData(matches);
  panel.show();
}

function handleSelect(e) {
  if (active) {
    active.parentNode.classList.remove('active');
  }
  active = e.target;
  active.parentNode.classList.add('active');
  showContent();
}

function handleClose() {
  panel.hide();
  active = null;
  items = null;
}

function showContent() {
  const index = +active.dataset.index;
  panel.pre.textContent = items[index].content;
}

let items;
let panel;
let active;
GM_registerMenuCommand('Explore tarball', main);
