#include <cbm.h>

unsigned char main(void) {
    *(unsigned char*)0x400 = 0x00;
    return 0;
}

void open_a_thing(void) {
    cbm_k_open();
}
