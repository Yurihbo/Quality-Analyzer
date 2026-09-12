# Quality Analyzer

## English

Quality Analyzer is a full-stack web application designed to evaluate public websites through a structured technical analysis.

The project brings together multiple inspection areas in a single interface, transforming publicly available website information into clear scores, findings and recommendations.

### Overview

Quality Analyzer focuses on:

- Website performance indicators
- SEO and metadata
- Security-related configuration
- Accessibility fundamentals
- HTML structure and document organization
- Referenced resources and network responses
- Technology detection
- Technical issues and actionable recommendations

The goal is to make website quality analysis more practical by bringing several technical checks into one workflow.

### Analysis Areas

| Area | Focus |
| --- | --- |
| Performance | Page weight, resources and loading-related indicators |
| SEO | Metadata, headings, canonical information and search-related markup |
| Security | HTTPS usage and security configuration signals |
| Accessibility | Language, viewport, image alternatives and semantic elements |
| Best Practices | General technical and structural recommendations |
| Errors | Failed resources and detected technical issues |
| Technologies | Technologies and infrastructure signals identified from public data |
| Structure | HTML elements and document organization |
| Network | HTTP response and resource information |

### Main Features

- Public website analysis
- Overall quality score and category scores
- Technology detection with supporting evidence
- Technical findings organized by severity
- Evidence and context for detected issues
- Recommendations for common problems
- HTML structure visualization
- Responsive interface
- Dark interface
- PDF report generation

### How It Works

1. A public website is selected for analysis.
2. The application validates the submitted address and prepares a safe request.
3. The website response is inspected without executing the target site's JavaScript.
4. HTML, metadata, headers and referenced resources are evaluated.
5. The collected information is organized into categories and findings.
6. The frontend presents the results through scores, details and recommendations.

### Architecture

```text
Quality Analyzer
├── client/
│   └── React application
│       ├── Analysis interface
│       ├── Progress state
│       ├── Score dashboard
│       ├── Findings and filters
│       └── Report export
│
├── server/
│   ├── Website analysis logic
│   ├── Validation and request handling
│   └── Server runtime
│
└── .github/workflows/
    └── Automated deployment
```

The frontend is responsible for the user experience and visualization of the analysis results. The backend handles the website inspection, data processing, validation and report generation.

### Tech Stack

**Frontend**

- React
- TypeScript
- Vite
- Tailwind CSS
- Wouter
- TanStack React Query
- Framer Motion
- Lucide React
- Recharts

**Backend**

- Node.js
- Express
- tRPC
- Zod
- TypeScript

**Tooling**

- pnpm
- Vite
- esbuild
- Vitest
- Prettier
- GitHub Actions

### Security Approach

Because the application analyzes external websites, the project was designed with request validation and controlled access in mind.

The analyzer is intentionally passive. It works with publicly accessible responses and does not attempt to authenticate, exploit vulnerabilities, brute-force services or modify the analyzed website.

### Project Goals

1. **Centralize technical analysis** — bring multiple website checks into one application.
2. **Make technical findings understandable** — present scores together with context and recommendations.
3. **Build a practical full-stack solution** — combine a modern interface with backend processing and automated deployment.

---

# Português

O **Quality Analyzer** é uma aplicação web full-stack desenvolvida para realizar uma análise técnica estruturada de sites públicos.

O projeto reúne diferentes tipos de verificações em uma única interface, transformando informações disponíveis publicamente em pontuações, problemas identificados e recomendações de melhoria.

## Objetivo

A proposta é simplificar uma análise que normalmente exigiria várias ferramentas e verificações manuais.

A aplicação reúne informações relacionadas a:

- Performance
- SEO
- Segurança
- Acessibilidade
- Estrutura HTML
- Recursos e respostas de rede
- Tecnologias utilizadas pelo site
- Erros e problemas técnicos

## Principais recursos

- Análise de sites públicos
- Pontuação geral e por categoria
- Identificação de tecnologias
- Classificação de problemas por severidade
- Evidências relacionadas aos problemas encontrados
- Recomendações de correção
- Visualização da estrutura HTML
- Interface responsiva
- Tema escuro
- Geração de relatório em PDF

## Funcionamento

O usuário informa um site público para análise. A aplicação realiza uma inspeção controlada das informações disponíveis na resposta do site, processa os dados encontrados e organiza os resultados em diferentes categorias.

A análise considera elementos como HTML, metadados, configurações de resposta, recursos utilizados e características técnicas da página.

Os resultados são então apresentados em um painel com indicadores, pontuações, problemas encontrados e recomendações.

## Desenvolvimento

O projeto foi estruturado separando a camada de interface da camada responsável pelo processamento das análises.

O frontend concentra a experiência do usuário, os indicadores e a visualização dos resultados. O backend concentra a lógica de análise, processamento das informações e validações necessárias para realizar as requisições de forma controlada.

Essa divisão permite manter o projeto organizado e facilita a evolução independente das diferentes partes da aplicação.

## Tecnologias utilizadas

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Wouter
- TanStack React Query
- Framer Motion
- Lucide React
- Recharts

### Backend

- Node.js
- Express
- tRPC
- Zod
- TypeScript

### Ferramentas

- pnpm
- Vitest
- Prettier
- GitHub Actions

## Segurança

O projeto foi desenvolvido considerando que a aplicação recebe endereços de sites externos. Por isso, existem validações e controles para reduzir riscos durante as requisições.

A análise é exclusivamente passiva: o sistema trabalha com informações públicas e não tenta acessar áreas autenticadas, explorar vulnerabilidades, realizar força bruta ou modificar o site analisado.

## O que o projeto demonstra

O Quality Analyzer reúne diferentes áreas de desenvolvimento em uma aplicação funcional, incluindo:

- Desenvolvimento frontend
- Desenvolvimento backend
- Integração entre cliente e servidor
- Processamento e organização de dados
- Validação de entradas
- Análise de conteúdo web
- Visualização de informações
- Geração de relatórios
- Deploy automatizado

O resultado é uma aplicação full-stack voltada para análise técnica de websites, com foco em organização, segurança, experiência de uso e apresentação clara dos resultados.

## Autor

Desenvolvido por **Yuri de Sousa Silva**.Yurihbo

[GitHub](https://github.com/Yurihbo) · [Quality Analyzer](https://github.com/Yurihbo/Quality-Analyzer)
