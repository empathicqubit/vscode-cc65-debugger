#include <stdio.h>
#include <cbm.h>

unsigned char main(void) {
    printf("Hello world!");
    return 0;
}

void open_a_thing(void) {
    cbm_k_open();
}
