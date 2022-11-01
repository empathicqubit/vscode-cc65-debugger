.segment "STARTUP"
.segment "INIT"
.segment "ONCE"
.segment "CODE"
.import _cbm_k_bsout

LDY #$00
JSR sub
loop:
LDA helloworld,Y
BEQ end
JSR _cbm_k_bsout
INY
JMP loop
end:
RTS

sub:
JSR subsub
RTS

subsub:
RTS

.segment "DATA"

helloworld: .byte "hello world", 0
