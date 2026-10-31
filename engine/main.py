import numpy as np

def resolver_perfil_termico(tempo_s: float, temp_banho_c: float, temp_inicial_c: float):
    if tempo_s <= 0:
        return temp_inicial_c, temp_inicial_c

    # Propriedades térmicas médias do açaí / água
    # Raio da baga: r = 0.007 m (14 mm de diâmetro)
    R = 0.007
    alpha = 1.4e-7  # Difusividade térmica (m^2/s)
    
    # Discretização com garantia de estabilidade numérica
    Nr = 15  # Número de nós radiais
    dr = R / (Nr - 1)
    
    # Passo de tempo seguro respeitando Fourier Fo <= 0.2
    dt_seguro = 0.2 * (dr**2) / alpha
    n_passos = int(np.ceil(tempo_s / dt_seguro))
    dt = tempo_s / n_passos

    # Malha de temperatura inicial (homogénea)
    T = np.full(Nr, temp_inicial_c, dtype=np.float64)
    r = np.linspace(0, R, Nr)

    # Coeficiente convectivo do banho maria com agitação
    h = 350.0       # W/(m^2·K)
    k = 0.6         # Condutividade térmica (W/m·K)
    biot_factor = h * dr / k

    # Integração temporal estável
    for _ in range(n_passos):
        T_novo = T.copy()
        
        # 1. Condição de simetria no centro (r = 0): dT/dr = 0
        # Regra de L'Hôpital na equação esférica: dT/dt = 6 * alpha * (T[1] - T[0]) / dr^2
        T_novo[0] = T[0] + 6.0 * alpha * (dt / (dr**2)) * (T[1] - T[0])
        
        # 2. Nós internos (1 a Nr - 2)
        for i in range(1, Nr - 1):
            termo_difusao = (T[i+1] - 2.0*T[i] + T[i-1]) / (dr**2)
            termo_esferico = (2.0 / r[i]) * ((T[i+1] - T[i-1]) / (2.0 * dr))
            T_novo[i] = T[i] + alpha * dt * (termo_difusao + termo_esferico)
            
        # 3. Superfície exterior (r = R): balanço convectivo de Cauchy
        T_novo[-1] = (T_novo[-2] + biot_factor * temp_banho_c) / (1.0 + biot_factor)
        
        T = np.clip(T_novo, temp_inicial_c, temp_banho_c)

    temp_centro = float(T[0])
    temp_superficie = float(T[-1])
    return temp_centro, temp_superficie