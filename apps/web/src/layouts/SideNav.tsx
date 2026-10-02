import { Menu, type MenuProps } from 'antd';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { groupKey, groupOfPath, type MenuGroup, selectedMenuKeys } from './menus';

const STORAGE_PREFIX = 'salesverse.nav.open:';

/** Groups the user left open; every group is open until the user first collapses one. */
function readOpen(storageKey: string, menu: MenuGroup[]): string[] {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) return JSON.parse(stored) as string[];
  } catch {
    // Fall through to the default.
  }
  return menu.filter((group) => group.label).map(groupKey);
}

function writeOpen(storageKey: string, keys: string[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(keys));
  } catch {
    // Storage may be unavailable (private mode); the menu still works without it.
  }
}

interface Props {
  menu: MenuGroup[];
  basePath: string;
  collapsed?: boolean;
  onNavigate?(): void;
}

/**
 * Module navigation: top-level entries, then collapsible groups. The group holding the
 * current page is always open; other groups keep the state the user left them in.
 */
export function SideNav({ menu, basePath, collapsed = false, onNavigate }: Props) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const storageKey = `${STORAGE_PREFIX}${basePath}`;
  const current = groupOfPath(menu, pathname);
  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    const stored = readOpen(storageKey, menu);
    return current && !stored.includes(current) ? [...stored, current] : stored;
  });

  // Opening another page opens its group (state adjusted during render, not in an effect).
  const [shownGroup, setShownGroup] = useState(current);
  if (current !== shownGroup) {
    setShownGroup(current);
    if (current && !openKeys.includes(current)) setOpenKeys([...openKeys, current]);
  }

  const items = useMemo<MenuProps['items']>(
    () =>
      menu.flatMap((group) => {
        const entries = group.entries
          .filter((entry) => !entry.anyOf || entry.anyOf.some((permission) => can(permission)))
          .map((entry) => ({ key: entry.path, icon: entry.icon, label: entry.label }));
        if (entries.length === 0) return [];
        if (!group.label) return entries;
        return [{ key: groupKey(group), icon: group.icon, label: group.label, children: entries }];
      }),
    [menu, can],
  );

  return (
    <Menu
      mode="inline"
      items={items}
      selectedKeys={selectedMenuKeys(menu, pathname)}
      {...(collapsed
        ? {}
        : {
            openKeys,
            onOpenChange: (keys: string[]) => {
              setOpenKeys(keys);
              writeOpen(storageKey, keys);
            },
          })}
      onClick={({ key }) => {
        navigate(key);
        onNavigate?.();
      }}
      className="app-menu"
    />
  );
}
