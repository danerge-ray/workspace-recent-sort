# workspace-recent-sort

让 DSH 侧边栏的**工作区**分组按「最近更新时间」排序。

一个纯客户端的 DSH 插件：不新增界面、不改动其他插件源码、不写入任何持久化顺序。

## 解决的问题

DSH 侧边栏只会对**工作区内**的会话按最近更新排序，「工作区」分组本身仍保持注册表里的存储顺序（创建顺序 / 拖拽顺序）。于是会出现这种情况：某个工作区里刚产生了全局最新的会话，这个工作区却依然沉在列表底部。

本插件在 Workspace Controller 发布快照时，把工作区分组按各自最新会话的时间重排一次，再交给渲染层：

- 排序方式为「最近更新」时：工作区按最新会话时间倒序排列；
- 排序方式为「手动排序」时：完全保持你拖拽出来的顺序，不介入；
- 只做读取投影，**不会**回写注册表顺序，退出插件即恢复原状。

## 特性

- 只包装 Workspace 快照的读取方法，不覆盖任何 UI 插槽，也不依赖具体侧边栏实现，升级宿主或替换侧边栏插件后仍然有效；
- 同时识别内置侧边栏与 `dsh-better-workspace` 的视图偏好键；
- 用一个缓存投影保证 `getSnapshot` 在输入不变时返回同一引用，不会引起 React 无限重渲染；
- 会话数据不可用时（没有时间戳）自动退回存储顺序，任何异常都不会影响侧边栏本身；
- Host 侧没有任何资源：没有网络请求、没有文件读写、没有定时器。

## 兼容性

- 在 DSH `0.2.x`（`web` profile）上开发与使用；
- 需要 `@deepseek-ai/dsh-api-workspace-controller` 提供的客户端 Workspace 服务；
- 未在其它 DSH 版本上做过独立验证。

## 安装

```bash
dsh plugin add github:danerge-ray/workspace-recent-sort
```

安装后重启 DSH，或在 Web GUI 中刷新页面，使 bundle 生效。

插件在 `package.json` 的 `dsh` 字段中声明了 bundle 与 web 客户端入口，DSH 会自动把它注册为插件并按 `cordis.patch.yml` 启用。

### 卸载

```bash
dsh plugin remove @local/workspace-recent-sort
```

如果 profile 的 `package.json` 里 `dsh.profile.bundles` 仍保留 `@local/workspace-recent-sort`，手动删掉这一项即可。

### 本地开发

```bash
git clone https://github.com/danerge-ray/workspace-recent-sort.git
dsh plugin add ./workspace-recent-sort
```

修改 `client.js` 后刷新 Web GUI 即可看到效果，无需重新安装。

## 使用

安装后无需配置：

1. 在侧边栏把排序方式切到「最近更新」；
2. 工作区分组会按各自最新会话的时间排列，最新活跃的工作区排在最上面；
3. 切回「手动排序」时，排序立即恢复为你拖拽的顺序。

## 目录结构

| 文件 | 作用 |
| --- | --- |
| `index.js` | Host 侧入口，只承载插件开关（`config.enabled`），无实际资源 |
| `client.js` | 真正的实现：包装 Workspace 快照读取，按最近更新排序 |
| `cordis.patch.yml` | 插件启用配置 |
| `locale/*.json` | 插件市场中的中英文标题与简介 |
| `icon.svg` | 插件图标 |

## English

**workspace-recent-sort** orders the DSH sidebar's *workspace* groups by the most recent session inside each group.

DSH sorts sessions inside a workspace by recency, but the workspace groups themselves stay in stored (creation / drag) order — so a workspace whose newest session just became the newest overall can still sit at the bottom. This plugin re-orders the workspace groups once, while the Workspace Controller publishes its snapshot, and only when the active view option is "Last updated". With the "Manual" view the stored order is returned untouched, and the persisted registry order is never written back.

- No UI slots are shadowed, no other plugin's source is touched: the wrapper survives upgrades of the host or of a sidebar-replacing plugin such as `dsh-better-workspace`.
- Purely client-side: no network requests, no file access, no timers on the Host side.

### Install

```bash
dsh plugin add github:danerge-ray/workspace-recent-sort
```

Restart DSH or reload the Web GUI afterwards.

### Compatibility

Developed and used against DSH `0.2.x` (the `web` profile). Not independently verified on other DSH versions.

## License

[MIT](./LICENSE) © danerge-ray
