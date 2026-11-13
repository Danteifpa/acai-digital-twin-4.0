# Modelo físico e numérico

Este documento descreve o modelo implementado em `engine/acai_twin/`. Todos os parâmetros estão em [`parametros.py`](../engine/acai_twin/parametros.py), cada um com a sua fonte.

## 1. Problema

Frutos de açaí são imersos em água quente (branqueamento) para inativar o *Trypanosoma cruzi*, que chega ao fruto em fezes ou fragmentos de barbeiro **aderidos à casca**. A legislação do Pará (2012) e do Amapá (2015) exige água a 80 °C por 10 s. O gêmeo digital estima, a partir da temperatura do banho, a temperatura **efetiva na superfície do fruto** e o instante em que o critério sanitário é cumprido.

## 2. Geometria

O fruto é tratado como uma esfera composta:

| Região | Raio | Observação |
|---|---|---|
| Caroço (endocarpo) | 0 ≤ r < r_c | ~85 % do volume do fruto |
| Polpa + casca | r_c ≤ r ≤ R | camada comestível, onde estão antocianinas e POD |

Com diâmetro padrão de 14 mm, r_c = R · 0,85^(1/3) ≈ 6,63 mm, e a polpa tem espessura de ≈ 0,37 mm.

## 3. Equação de condução

$$
\rho c\,\frac{\partial T}{\partial t} = \frac{1}{r^2}\frac{\partial}{\partial r}\left(k\,r^2\,\frac{\partial T}{\partial r}\right),\qquad 0 < r < R
$$

Condições de contorno:

- **Centro (simetria):** $\partial T/\partial r = 0$ em $r = 0$
- **Superfície (convecção, Robin):** $-k\,\partial T/\partial r = h\,(T - T_\infty)$ em $r = R$

Durante a imersão, $T_\infty$ é a temperatura medida do banho e $h = h_\text{imersão}$. Após o corte, $T_\infty$ é a temperatura ambiente e $h = h_\text{resfriamento}$.

## 4. Discretização: volumes finitos

Nós em $r_i = i\,\Delta r$, $i = 0 \dots N$. Cada nó representa a casca esférica $[r_i - \Delta r/2,\ r_i + \Delta r/2]$, truncada em 0 e em R. O balanço de energia em cada volume é

$$
C_i\,\frac{dT_i}{dt} = \sum_j G_{ij}\,(T_j - T_i) + \delta_{iN}\,h A_s\,(T_\infty - T_N)
$$

com

- $C_i = \sum \rho c\,V$: capacidade térmica do volume, dividida entre caroço e polpa quando a interface cai dentro dele;
- $G_{ij} = k_f\,4\pi r_f^2/\Delta r$: condutância entre nós vizinhos, com $k_f$ dado pela **média harmônica** das duas meias-células (correta na interface caroço/polpa);
- $A_s = 4\pi R^2$.

A integração no tempo é explícita (Euler). O passo pedido é subdividido automaticamente para respeitar o critério de estabilidade

$$
\Delta t \le 0{,}9 \cdot \min_i \frac{C_i}{\sum_j G_{ij} + \delta_{iN} h A_s}
$$

Isso garante coeficientes positivos e, portanto, o princípio do máximo discreto. Esse ponto é verificado em teste.

Por que volumes finitos e não diferenças finitas:

1. conservam energia exatamente no discreto;
2. tratam o centro sem singularidade (sem regra de L'Hôpital);
3. acomodam propriedades diferentes no caroço e na polpa.

## 5. Cinética

A cinética é integrada **em cada nó de polpa**, com a história térmica do próprio nó, e a média é ponderada pela massa de polpa. Usa-se a regra do trapézio na taxa.

### Antocianinas: Arrhenius de 1ª ordem

$$
\frac{dC}{dt} = -k(T)\,C,\qquad k(T) = k_0\,e^{-E_a/(R_g T)}
$$

$E_a = 42{,}8$ kJ/mol e $k_0 = 36{,}6$ s⁻¹ (Anjos et al., 2020). Esses valores reproduzem $k(90\,°C) \approx 0{,}002$ min⁻¹.

### Peroxidase (POD): bifásica, modelo D–z

$$
\frac{A}{A_0} = f\,e^{-k_1 t} + (1-f)\,e^{-k_2 t},\qquad k_i = \frac{\ln 10}{D_i(T)},\qquad D_i(T) = D_{i,\text{ref}}\cdot 10^{(T_\text{ref}-T)/z_i}
$$

| Fração | $D_{89\,°C}$ | z | Fonte |
|---|---:|---:|---|
| lábil | 7,10 s | 4,3 °C | Costa (2019) |
| resistente | 254 s | 2,4 °C | Costa (2019) |
| fração lábil $f$ | 0,80 | — | **hipótese** |

Como cada nó acumula $\ln(C/C_0)$, a inativação nunca "regride" quando o fruto esfria.

## 6. Critério sanitário e corte preditivo

- **Tempo letal na superfície:** soma dos intervalos em que $T_N \ge 80\,°C$, interpolada dentro do passo.
- **Conformidade:** tempo letal ≥ 10 s.
- **Previsão:** a cada leitura do sensor, o motor copia o estado atual e simula adiante, com o banho constante, até cumprir o critério (horizonte de 180 s). O resultado é `previsao_corte_s`.
- **Ação recomendada:** `RETIRAR_DO_BANHO` quando o critério é cumprido, `AUMENTAR_TEMPERATURA_DO_BANHO` quando a previsão não converge no horizonte, e `MANTER` nos demais casos.

## 7. Calibração do coeficiente convectivo

$h_\text{imersão}$ foi ajustado por mínimos quadrados contra as temperaturas de superfície medidas pela Embrapa (Bezerra et al.) em banhos a 80,2 °C e 88,9 °C, entre 2 e 10 s. O resultado é $h \approx 4700$ W/m²K, com RMSE ≈ 0,5 °C. Veja [validacao.md](validacao.md) e `engine/scripts/calibrar_h.py`.

## 8. Hipóteses e limitações

| Item | Situação | Como resolver |
|---|---|---|
| k, ρ, c do caroço | estimados (literatura de sementes lignocelulósicas) | medir com termopar no centro e recalibrar |
| fração lábil da POD | assumida 0,80 | conferir no texto completo de Costa (2019) |
| fruto isolado e esférico | simplificação | sensibilidade ao diâmetro já incluída |
| banho com temperatura uniforme | o sensor mede um ponto | usar a leitura real (modo tempo real) |
| inativação do *T. cruzi* | critério regulatório, sem cinética própria | incluir dados de letalidade térmica, se houver |
| $h_\text{resfriamento}$ | assumido 300 W/m²K | não afeta o critério sanitário |
