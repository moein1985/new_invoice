# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - status [ref=e2]:
    - generic [ref=e3]:
      - img [ref=e5]
      - generic [ref=e7]:
        - text: Static route
        - button "Hide static indicator" [ref=e8] [cursor=pointer]:
          - img [ref=e9]
  - alert [ref=e12]
  - generic [ref=e14]:
    - generic [ref=e15]:
      - heading "سیستم مدیریت فاکتور" [level=1] [ref=e16]
      - paragraph [ref=e17]: لطفاً برای ادامه وارد شوید
    - generic [ref=e18]:
      - generic [ref=e19]:
        - generic [ref=e20]:
          - generic [ref=e21]: نام کاربری
          - textbox "نام کاربری" [ref=e22]:
            - /placeholder: admin
        - generic [ref=e23]:
          - generic [ref=e24]: رمز عبور
          - textbox "رمز عبور" [ref=e25]:
            - /placeholder: ••••••••
      - button "ورود" [ref=e26]
      - generic [ref=e27]:
        - paragraph [ref=e28]: "حساب مدیر سیستم:"
        - paragraph [ref=e29]: 👤 admin / admin123
  - region "Notifications (F8)":
    - list
```