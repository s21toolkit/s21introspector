# s21introspector

Утилита для интроспекции схемы GQL API платформы edu.21-school.ru.

## Установка

> [!IMPORTANT]
> Для работы требуется [Bun](https://bun.sh)

```sh
bun install --global github:s21toolkit/s21introspector
```

## Использование

Получение GraphQL схемы:

```sh
s21 auth | s21introspector introspect
s21introspector introspect --username login@student.21-school.ru --password p4s5w0rd
s21introspector introspect --username login@student.21-school.ru --password p4s5w0rd --out-file schema.graphql
```

Поддерживается подстановка статических свойств в `out-file`, например `schema_{PRODUCT_VERSION}.graphql` (по умолчанию).

> См. `s21introspector introspect --help`

Получение статических свойств платформы:

```sh
s21introspector static
s21introspector static --select PRODUCT_VERSION --no-name
```

> См. `s21introspector static --help`

Получение исходного кода платформы:

```sh
s21introspector sources
s21introspector sources --out-dir edu_src
```

> См. `s21introspector sources --help`
