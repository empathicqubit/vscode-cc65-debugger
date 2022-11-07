struct l {
    unsigned char m;
    unsigned char n;
};

struct hello {
    unsigned char j;
    unsigned char k;
    struct l l;
};

struct sub {
    unsigned char x;
    unsigned char y;
};

union xy {
    struct sub xy;
    unsigned int mem;
};

typedef struct hello thingy;

unsigned char globby;

unsigned char test_local_vars_main(void) {
    static unsigned char weehah;
    static unsigned char bonza = 0x42;
    register unsigned char blarg = 1;
    register unsigned char blerg = 2;
    unsigned char i = 3;
    unsigned int j = 4, k = 4;
    unsigned int *random;
    unsigned char *lol;
    signed char whoa;
    struct hello wow;
    thingy *cool;
    union xy xy;
    xy.xy.x = 0x01;
    xy.xy.y = 0x02;
    cool = &wow;
    random = 0x03fc;
    *random = 0x3003;
    globby = 0x34;
    whoa = -1;
    wow.j = 3;
    wow.k = 4;
    wow.l.m = 5;
    wow.l.n = 6;
    i = 0x23;
    j = 0x1337;
    weehah = 0x59;
    lol = "copter";

    return 0;
}