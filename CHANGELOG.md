# Changelog

## v1.2.0 - 2026-06-17

### 新增功能
- **问答节点分支可视化**：每个选项生成独立输出端口，垂直均匀分布
- **连线分支标签**：每条边起点显示对应选项名称，一目了然
- **鼠标悬浮提示**：连接点显示选项名称提示

### 功能修复

#### 数据一致性
- 修复"不修改直接保存破坏节点数据"问题 → 属性面板与节点数据双向同步
- 修复"输入参数引用保存后丢失"问题 → 修正 JSON 序列化，移除错误的 HTML 转义
- 修复"粘贴节点后引用指向错误 output"问题 → `blockID` 映射路径修正为 `content.blockID`

#### 多选交互逻辑
- 修复"按住 Ctrl 选中单个节点属性面板仍显示全部节点"问题 → 选中数量为 1 时正确显示单个属性面板
- 修复"松开 Ctrl 点击新节点仍保持增选"问题 → 松开 Ctrl 自动切换单选模式
- 修复"多选后单击边未取消节点选中"问题 → 单击边无条件清空节点选中
- 修复"多选后拖动选中节点被取消选中"问题 → 点击已选中节点保持多选状态
- 修复"Ctrl+框选不能累计选中"问题 → 支持 Ctrl+多次框选累加选中

### 架构改进
- 支持 `sourcePort` 端口信息存储在边数据中
- 兼容 Coze 格式剪贴板导入的 `sourcePortID`
- 引用数据结构保持 `{ type: 'ref', content: { blockID, name } }` 一致
- 所有模块职责清晰，模块化拆分完成

### 节点类型支持（共 30+ 种）
- start / end
- llm / image_generate / video_generation / knowledge
- condition / loop / break / question / intent
- text / code / comment / json_parse
- http / webhook / database / email
- input / output / variable_assign / variable_merge / batch
- delay / async_task / plugin

---

## v1.1.0 - 之前版本

- 支持 Coze 工作流剪贴板导入/导出
- 支持动态输入输出参数配置
- 支持变量引用选择器
- 支持节点对齐与分布
- 支持历史撤销/重做
- 支持自动保存
- 支持国际化（中文/英文）
- 支持暗色主题