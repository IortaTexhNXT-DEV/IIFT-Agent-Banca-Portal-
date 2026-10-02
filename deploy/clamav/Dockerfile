# ClamAV daemon for upload scanning. The stock image binds clamd to IPv4 only;
# this one listens on both families so services reach it over IPv6-only or
# dual-stack private networks (Docker Compose, Railway).
FROM clamav/clamav:stable
RUN sed -i 's/^#\?TCPAddr .*/TCPAddr ::/' /etc/clamav/clamd.conf \
  && grep -q '^TCPAddr ::' /etc/clamav/clamd.conf \
  && sed -i 's/^#\?TCPSocket .*/TCPSocket 3310/' /etc/clamav/clamd.conf
