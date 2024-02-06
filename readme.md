# s21introspector

Утилита для интроспекции схемы GQL API платформы edu.21-school.ru.

## Установка

> [!IMPORTANT]
> Для работы требуется [Bun](https://bun.sh)

```sh
bun install --global github:s21toolkit/s21introspector
```

## Использование

> `s21i` - псевдоним для `s21introspector`

Получение GraphQL схемы:

```sh
s21i introspect --token MyAccessToken
s21i introspect $(s21i auth login@student.21-school.ru p4s5w0rd)
s21i introspect $(s21i auth login@student.21-school.ru p4s5w0rd) --out-file schema.graphql
s21i introspect $(s21 auth | s21i _) # Авторизация через s21cli
```

Поддерживается подстановка статических свойств в `out-file`, например `schema_{PRODUCT_VERSION}.gql` (по умолчанию).

Может принимать HAR лог в качестве аргумента. Все страницы, скрипты, запросы и их связи их лога будут проанализированы.
Вместо возможные данные будут браться из лога вместо запросов по сети.

```sh
s21i introspect $(s21 auth | s21i _) log.har
```

Флаг `split-operations` позволяет сгенерировать отдельный файлы для всех операций (запросов, мутаций и тд.).
В таком режиме `out-file` будет обозначать результирующую директорию.

```sh
s21i introspect $(s21 auth | s21i _) --split-operations --out-file schema
```

```txt
schema/
   schema.gql
   operations/
      getUsers.gql
      getCurrentUser.gql
```

Если нужны только типы (без операция) следует использовать флаг `types-only`.

> См. `s21i introspect --help`

Получение статических свойств платформы:

```sh
s21i static
s21i static --select PRODUCT_VERSION --no-name
```

> См. `s21i static --help`

Получение исходного кода платформы:

```sh
s21i sources
s21i sources --out-dir edu_src
```

> См. `s21i sources --help`
