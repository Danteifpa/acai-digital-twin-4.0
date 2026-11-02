# AçaíThermal Twin 4.0 🍇⚡

> **Digital Twin para Simulação Termofísica e Otimização Cinética da Pasteurização do Açaí (*Euterpe oleracea*)**  
> *Trabalho de Conclusão de Curso 1 (TCC 1) — Bacharelado em Ciência e Tecnologia — IFPA Campus Ananindeua*

---

[![Licence](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![SESPA](https://img.shields.io/badge/Sanitário-Portaria%20SESPA%20453%2F2019-emerald)](https://saude.pa.gov.br)

---

## 📌 Visão Geral

O **AçaíThermal Twin** é um sistema ciber-físico (CPS) e gêmeo digital desenvolvido para solucionar o clássico dilema termodinâmico da agroindústria do açaí: **assegurar 100% de letalidade térmica contra o *Trypanosoma cruzi*** (agente da Doença de Chagas) sem degradar o valor fitoquímico e sensorial das **antocianinas**.

Diferente do método empírico convencional — que opera às cegas com tempos estáticos de imersão —, este sistema calcula em tempo real o perfil de penetração térmica no centro crítico ($r=0$) da baga e dispara o corte térmico preditivo assim que a inativação enzimática de segurança é atingida.

---

## 🔬 Fundamentação Teórico-Científica

### 1. Condução Transiente 1D em Coordenadas Esféricas (EDP de Fourier)
Considerando a baga de açaí como uma esfera equivalente de raio $R$:

$$\frac{\partial T}{\partial t} = \alpha \left[ \frac{\partial^2 T}{\partial r^2} + \frac{2}{r} \frac{\partial T}{\partial r} \right]$$

* **Condição no Centro ($r = 0$):** $\left. \frac{\partial T}{\partial r} \right|_{r=0} = 0$ (Simetria térmica)
* **Condição na Fronteira ($r = R$):** $T(R, t) = T_{\text{banho}}(t)$ (Transferência superficial)
* **Critério de Estabilidade Numérica (FDM Explícito):** $\text{Fo}_\Delta = \frac{\alpha \cdot \Delta t}{(\Delta r)^2} \le 0{,}5$

### 2. Cinética Concorrente de Arrhenius
Modelagem da inativação da enzima Peroxidase (POD) e da taxa de retenção das antocianinas totais (Cianidina 3-glicosídeo e Cianidina 3-rutinosídeo):

$$\frac{dC}{dt} = -k(T) \cdot C \quad \text{onde} \quad k(T) = A \cdot \exp\left(-\frac{E_a}{R_{\text{gas}} \cdot T}\right)$$

---

## ⚖️ Conformidade Regulatória e Resultados

| Parâmetro | Método Convencional (Empírico) | AçaíThermal Twin (Otimizado) | Critério / Norma |
| :--- | :---: | :---: | :--- |
| **Temperatura Centro ($r=0$)** | Não monitorada / Incerta | **$\ge 70{,}0\ ^\circ\text{C}$** | Letalidade *T. cruzi* |
| **Inativação de POD** | Variável | **$> 90{,}0\%$** | Portaria SESPA nº 453/2019 |
| **Retenção de Antocianinas** | $\approx 50\% - 55\%$ (Perda severa) | **$> 90{,}0\%$** | MAPA IN nº 37/2018 |
| **Eficiência Energética** | Consumo redundante | **Economia de até $\approx 38\text{ kJ/kg}$** | Otimização Térmica |

---

## 🏗️ Arquitetura do Sistema
