.segment "STARTUP"
.segment "INIT"
.segment "ONCE"
.segment "CODE"
.import _cbm_k_bsout

LDY #$00
loop:
LDA helloworld,Y
BEQ end
JSR _cbm_k_bsout
INY
JMP loop
end:
RTS

helloworld: .byte "hello world", 0