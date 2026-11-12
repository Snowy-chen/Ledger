
import {
  Alert,
  Button,
  ConfigProvider,
  DatePicker,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Spin,
} from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from './App.vue';
import './styles.css';

/**
 * Ant Design Vue is registered once, here, and only the components this app
 * actually uses are pulled in. `app.use(Antd)` — the whole library — would
 * double the bundle for no benefit at this size.
 *
 * Registering a parent also registers its children: `Form` brings FormItem,
 * `Input` brings Search, and `DatePicker` brings MonthPicker.
 */
const antdComponents = [
  Alert,
  Button,
  ConfigProvider,
  DatePicker,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Spin,
];

const app = createApp(App);

for (const component of antdComponents) {
  app.use(component);
}

app.use(createPinia()).mount('#app');
