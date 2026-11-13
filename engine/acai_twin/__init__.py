"""AçaíThermal Twin — modelo numérico do branqueamento de frutos de açaí.

Módulos:
    parametros     parâmetros físicos, cinéticos e sanitários (com fontes)
    termico        condução transiente em esfera composta (volumes finitos)
    cinetica       antocianinas (Arrhenius) e peroxidase (bifásica, D–z)
    processo       lote em tempo real, corte preditivo e simulação completa
    armazenamento  persistência SQLite e exportação CSV
    analitico      solução em série de referência para verificação
"""

__version__ = "5.1.0"
