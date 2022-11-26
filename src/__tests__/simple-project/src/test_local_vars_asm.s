.segment "CODE"
.export _dummy
.proc _dummy
    RTS
.endproc

.segment "DATA"
globby: .byte $96